import { AxiosError } from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import express from "express";
import { Request, RequestHandler } from "express-serve-static-core";
import session from "express-session";
import * as fs from "fs";
import html from "html-literal";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { v4 as generateUuid } from "uuid";

import { version } from "../package.json";
import { CallbackInfo, CountryCode, VerifyOnce } from "../src";

// notify of missing .env file
if (!fs.existsSync(path.join(__dirname, ".env"))) {
  console.log(
    "Please copy the example configuration file _.env to .env and edit contents as needed"
  );

  process.exit(1);
}

// load configuration from .env file
dotenv.config({ path: path.join(__dirname, ".env") });

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// represents a user in our system
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
  email: string;
}

// represents verification attempt in our system
export interface Verification {
  userId: string;
  transactionId: string;
  url: string;
  isCorrectUser: boolean;
  info: CallbackInfo | null;
}

// represents a simple in-memory database
interface Database {
  users: User[];
  verifications: Verification[];
}

// initiation request parameters
interface InitiateRequestParameters {
  firstName: string;
  lastName: string;
  country: string;
  email: string;
}

// application configuration (parameters are read from the .env file)
const config = {
  host: process.env.HOST || "localhost",
  port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
  ssl: {
    enabled: process.env.SSL_ENABLED === "true",
    cert: process.env.SSL_CERT || "",
    key: process.env.SSL_KEY || "",
  },
  verifyOnce: {
    baseUrl:
      process.env.API_BASE_URL || "https://test-app.verifyonce.com/api/verify",
    username: process.env.API_USERNAME || "",
    password: process.env.API_PASSWORD || "",
  },
};

// create simple in-memory database
const database: Database = {
  users: [],
  verifications: [],
};

function query(request: Request) {
  const userId = request.session ? request.session.userId : undefined;

  return {
    user: database.users.find((user) => user.id === userId),
    verification: database.verifications.find(
      (verification) => verification.userId === userId
    ),
  };
}

// setup verify-once
const verifyOnce = new VerifyOnce(config.verifyOnce);

// run in an async IIFE to be able to use async-await
(async () => {
  // create express app
  const app = express();

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "",
      resave: false,
      saveUninitialized: false,
    }) as RequestHandler
  );

  // setup body parser middleware to support form, json and plain text payloads
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(bodyParser.text());

  // handle index page request
  app.get("/", (request, response, _next) => {
    const { user, verification } = query(request);

    const userData = {
      firstName: user?.firstName || "John",
      lastName: user?.lastName || "Rambo",
      country: user?.country || "EST",
      email: user?.email || "john@rambo.com",
    };

    response.send(html`
      <p>
        <h1>VerifyOnce Integration Example</h1>
      </p>

      <form method="post" action="/initiate">
        <p>
          <h2>User info</h2>
        </p>
        <p>
          This is the information that the integrating system already knows and uses to compare against the information received from VerifyOnce.
        </p>
        <p><input id="firstName" name="firstName" value="${
          userData.firstName
        }" /> <label for="firstName">First name</label></p>
        <p><input id="lastName" name="lastName" value="${
          userData.lastName
        }" /> <label for="lastName">Last name</label></p>
        <p><input id="country" name="country" value="${
          userData.country
        }" minlength="3" maxlength="3" /> <label for="country">Country code (3 letters)</label></p>
        <p><input id="email" name="email" value="${
          userData.email
        }" /> <label for="email">Email</label></p>
        <p>
          <button type="submit">Start verification</button>
        </p>
      </form>

      <p>
        <h2>State</h2>
      </p>
      <p>
        This is the information that the integrator knows internally and that it has received from VerifyOnce.
      </p>
      <p>
        Integrator should use this information to decide whether the user can be considered verified or not.
      </p>
      <p>${debug({ database: { user, verification } })}</p>

      <p>
        <em>Version: ${version}</em>
      </p>
    `);
  });

  // handle initiation request (index page form posts to this)
  app.post("/initiate", async (request, response, next) => {
    const { verification } = query(request);

    if (verification) {
      response.redirect(verification.url);

      return;
    }

    // extract initiation parameters
    const {
      firstName,
      lastName,
      country,
      email,
    } = request.body as InitiateRequestParameters;

    // create new user
    const user: User = {
      id: generateUuid(),
      firstName,
      lastName,
      country,
      email,
    };
    database.users.push(user);

    // attempt to initiate verification
    try {
      const initiateResponse = await verifyOnce.initiate({
        firstName,
        lastName,
        country: country as CountryCode,
        email,
      });

      // create new verification
      const verification: Verification = {
        userId: user.id,
        transactionId: initiateResponse.transactionId,
        url: initiateResponse.url,
        isCorrectUser: false,
        info: null,
      };
      database.verifications.push(verification);

      if (request.session) {
        request.session.userId = user.id;
      }

      // redirect to the verification page
      response.redirect(initiateResponse.url);
    } catch (err) {
      const error = err as AxiosError;

      // handle authentication error
      if (error.response) {
        const { status, data } = error.response;

        console.log("VerifyOnce request failed", { status, data });

        if (status === 400) {
          response.send(`Invalid input: ${data.errorMessage}`);

          return;
        }

        if (status === 401) {
          response.send(
            "Authentication failed, check integrator username and password"
          );

          return;
        }
      }

      // let express handle other errors
      next(err);
    }
  });

  // handle the integration callback
  app.post("/callback", async (request, response, _next) => {
    try {
      // extract callback info and also validate the signature (throws if invalid)
      const info = verifyOnce.verifyCallbackInfo(request.body);

      // find the verification from the database
      const verification = database.verifications.find(
        (item) => item.transactionId === info.transaction.id
      );

      // handle failure to find such transaction
      if (!verification) {
        // you could respond with HTTP 2xx not to get the same info retried
        response
          .status(404)
          .send(
            `Verification with transaction id "${info.transaction.id}" could not be found`
          );

        return;
      }

      // find the local verification user
      const user = database.users.find(
        (item) => item.id === verification.userId
      );

      // the user should exist at this point
      if (!user) {
        throw new Error(
          `Verification user with id "${verification.userId}" not found, this should not happen`
        );
      }

      // store the verification info
      verification.info = info;

      // check that the verified user matches logged-in user
      verification.isCorrectUser = isCorrectUser(verification.info, user);

      // log callback info
      console.log("received valid callback", {
        body: request.body,
        info,
        verification,
        user,
      });

      // what are the odds of successful response (used to test retry logic)
      const successOdds = 1 / 2;

      // maximum random simulated response latency in milliseconds (used to test timeout)
      const maxSimulatedLatency = 2000;

      // roll the dice and send failure response half of the times to test the retry logic
      if (Math.random() < successOdds) {
        const simulatedLatency = Math.random() * maxSimulatedLatency;

        setTimeout(() => {
          // respond with HTTP 2xx response code to be considered valid handled callback
          response.send("OK");
        }, simulatedLatency);
      } else {
        // respond with non 2xx to be considered failed delivery attempt, the status delivery will be retried
        response.status(500).send("Simulated internal error");
      }
    } catch (error) {
      console.log("received invalid callback", {
        body: request.body,
        error,
      });

      response
        .status(400)
        .send(`Invalid JWT token provided (${error.message})`);
    }
  });

  // create either http or https server if ssl is enabled
  const server = config.ssl.enabled
    ? https.createServer(
        {
          cert: fs.readFileSync(config.ssl.cert),
          key: fs.readFileSync(config.ssl.key),
        },
        app
      )
    : http.createServer(app);

  // start the server
  server.listen(config.port, () => {
    console.log(`Example integration server started on port ${config.port}`);

    // also start a server on http to redirect to https if SSL is enabled
    if (config.ssl.enabled) {
      express()
        .use((request, response, _next) => {
          response.redirect(`https://${config.host}${request.originalUrl}`);
        })
        .listen(80);
    }
  });
})().catch((error) => console.error(error));

// returns whether verified user matches the correct (logged in) user
function isCorrectUser(verification: CallbackInfo, user: User) {
  // consider not valid if identity verification has not been performed
  if (verification.identityVerification === null) {
    return false;
  }

  // require first name to match (case-insensitive)
  if (
    verification.identityVerification.idFirstName === null ||
    verification.identityVerification.idFirstName === "N/A" ||
    user.firstName.toLowerCase() !==
      verification.identityVerification.idFirstName.toLowerCase()
  ) {
    return false;
  }

  // require last name to match (case-insensitive)
  if (
    verification.identityVerification.idLastName === null ||
    verification.identityVerification.idLastName === "N/A" ||
    user.lastName.toLowerCase() !==
      verification.identityVerification.idLastName.toLowerCase()
  ) {
    return false;
  }

  // name matches, all good (integrator could choose to verify additional known info such as date of birth etc)
  return true;
}

// debugging helper, renders data as formatted json
function debug(data: any): string {
  return html` <pre>${JSON.stringify(data, null, "  ")}</pre> `;
}
