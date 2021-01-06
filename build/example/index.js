"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var body_parser_1 = __importDefault(require("body-parser"));
var dotenv_1 = __importDefault(require("dotenv"));
var express_1 = __importDefault(require("express"));
var express_session_1 = __importDefault(require("express-session"));
var fs = __importStar(require("fs"));
var html_literal_1 = __importDefault(require("html-literal"));
var http = __importStar(require("http"));
var https = __importStar(require("https"));
var path = __importStar(require("path"));
var uuid_1 = require("uuid");
var package_json_1 = require("../package.json");
var src_1 = require("../src");
// notify of missing .env file
if (!fs.existsSync(path.join(__dirname, ".env"))) {
    console.log("Please copy the example configuration file _.env to .env and edit contents as needed");
    process.exit(1);
}
// load configuration from .env file
dotenv_1.default.config({ path: path.join(__dirname, ".env") });
// application configuration (parameters are read from the .env file)
var config = {
    host: process.env.HOST || "localhost",
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    ssl: {
        enabled: process.env.SSL_ENABLED === "true",
        cert: process.env.SSL_CERT || "",
        key: process.env.SSL_KEY || "",
    },
    verifyOnce: {
        baseUrl: process.env.API_BASE_URL || "https://test-app.verifyonce.com/api/verify",
        username: process.env.API_USERNAME || "",
        password: process.env.API_PASSWORD || "",
    },
};
// create simple in-memory database
var database = {
    users: [],
    verifications: [],
};
function query(request) {
    var userId = request.session ? request.session.userId : undefined;
    return {
        user: database.users.find(function (user) { return user.id === userId; }),
        verification: database.verifications.find(function (verification) { return verification.userId === userId; }),
    };
}
// setup verify-once
var verifyOnce = new src_1.VerifyOnce(config.verifyOnce);
// run in an async IIFE to be able to use async-await
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var app, server;
    return __generator(this, function (_a) {
        app = express_1.default();
        app.use(express_session_1.default({
            secret: process.env.SESSION_SECRET || "",
            resave: false,
            saveUninitialized: false,
        }));
        // setup body parser middleware to support form, json and plain text payloads
        app.use(body_parser_1.default.urlencoded({ extended: false }));
        app.use(body_parser_1.default.json());
        app.use(body_parser_1.default.text());
        // handle index page request
        app.get("/", function (request, response, _next) {
            var _a = query(request), user = _a.user, verification = _a.verification;
            var userData = {
                firstName: (user === null || user === void 0 ? void 0 : user.firstName) || "John",
                lastName: (user === null || user === void 0 ? void 0 : user.lastName) || "Rambo",
                country: (user === null || user === void 0 ? void 0 : user.country) || "EST",
                email: (user === null || user === void 0 ? void 0 : user.email) || "john@rambo.com",
            };
            response.send(html_literal_1.default(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      <p>\n        <h1>VerifyOnce Integration Example</h1>\n      </p>\n\n      <form method=\"post\" action=\"/initiate\">\n        <p>\n          <h2>User info</h2>\n        </p>\n        <p>\n          This is the information that the integrating system already knows and uses to compare against the information received from VerifyOnce.\n        </p>\n        <p><input id=\"firstName\" name=\"firstName\" value=\"", "\" /> <label for=\"firstName\">First name</label></p>\n        <p><input id=\"lastName\" name=\"lastName\" value=\"", "\" /> <label for=\"lastName\">Last name</label></p>\n        <p><input id=\"country\" name=\"country\" value=\"", "\" minlength=\"3\" maxlength=\"3\" /> <label for=\"country\">Country code (3 letters)</label></p>\n        <p><input id=\"email\" name=\"email\" value=\"", "\" /> <label for=\"email\">Email</label></p>\n        <p>\n          <button type=\"submit\">Start verification</button>\n        </p>\n      </form>\n\n      <p>\n        <h2>State</h2>\n      </p>\n      <p>\n        This is the information that the integrator knows internally and that it has received from VerifyOnce.\n      </p>\n      <p>\n        Integrator should use this information to decide whether the user can be considered verified or not.\n      </p>\n      <p>", "</p>\n\n      <p>\n        <em>Version: ", "</em>\n      </p>\n    "], ["\n      <p>\n        <h1>VerifyOnce Integration Example</h1>\n      </p>\n\n      <form method=\"post\" action=\"/initiate\">\n        <p>\n          <h2>User info</h2>\n        </p>\n        <p>\n          This is the information that the integrating system already knows and uses to compare against the information received from VerifyOnce.\n        </p>\n        <p><input id=\"firstName\" name=\"firstName\" value=\"",
                "\" /> <label for=\"firstName\">First name</label></p>\n        <p><input id=\"lastName\" name=\"lastName\" value=\"",
                "\" /> <label for=\"lastName\">Last name</label></p>\n        <p><input id=\"country\" name=\"country\" value=\"",
                "\" minlength=\"3\" maxlength=\"3\" /> <label for=\"country\">Country code (3 letters)</label></p>\n        <p><input id=\"email\" name=\"email\" value=\"",
                "\" /> <label for=\"email\">Email</label></p>\n        <p>\n          <button type=\"submit\">Start verification</button>\n        </p>\n      </form>\n\n      <p>\n        <h2>State</h2>\n      </p>\n      <p>\n        This is the information that the integrator knows internally and that it has received from VerifyOnce.\n      </p>\n      <p>\n        Integrator should use this information to decide whether the user can be considered verified or not.\n      </p>\n      <p>", "</p>\n\n      <p>\n        <em>Version: ", "</em>\n      </p>\n    "])), userData.firstName, userData.lastName, userData.country, userData.email, debug({ database: { user: user, verification: verification } }), package_json_1.version));
        });
        // handle initiation request (index page form posts to this)
        app.post("/initiate", function (request, response, next) { return __awaiter(void 0, void 0, void 0, function () {
            var verification, _a, firstName, lastName, country, email, user, initiateResponse, verification_1, err_1, error, _b, status_1, data;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        verification = query(request).verification;
                        if (verification) {
                            response.redirect(verification.url);
                            return [2 /*return*/];
                        }
                        _a = request.body, firstName = _a.firstName, lastName = _a.lastName, country = _a.country, email = _a.email;
                        user = {
                            id: uuid_1.v4(),
                            firstName: firstName,
                            lastName: lastName,
                            country: country,
                            email: email,
                        };
                        database.users.push(user);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, verifyOnce.initiate({
                                firstName: firstName,
                                lastName: lastName,
                                country: country,
                                email: email,
                            })];
                    case 2:
                        initiateResponse = _c.sent();
                        verification_1 = {
                            userId: user.id,
                            transactionId: initiateResponse.transactionId,
                            url: initiateResponse.url,
                            isCorrectUser: false,
                            info: null,
                        };
                        database.verifications.push(verification_1);
                        if (request.session) {
                            request.session.userId = user.id;
                        }
                        // redirect to the verification page
                        response.redirect(initiateResponse.url);
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _c.sent();
                        error = err_1;
                        // handle authentication error
                        if (error.response) {
                            _b = error.response, status_1 = _b.status, data = _b.data;
                            console.log("VerifyOnce request failed", { status: status_1, data: data });
                            if (status_1 === 400) {
                                response.send("Invalid input: " + data.errorMessage);
                                return [2 /*return*/];
                            }
                            if (status_1 === 401) {
                                response.send("Authentication failed, check integrator username and password");
                                return [2 /*return*/];
                            }
                        }
                        // let express handle other errors
                        next(err_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        // handle the integration callback
        app.post("/callback", function (request, response, _next) { return __awaiter(void 0, void 0, void 0, function () {
            var info_1, verification_2, user, successOdds, maxSimulatedLatency, simulatedLatency;
            return __generator(this, function (_a) {
                try {
                    info_1 = verifyOnce.verifyCallbackInfo(request.body);
                    verification_2 = database.verifications.find(function (item) { return item.transactionId === info_1.transaction.id; });
                    // handle failure to find such transaction
                    if (!verification_2) {
                        // you could respond with HTTP 2xx not to get the same info retried
                        response
                            .status(404)
                            .send("Verification with transaction id \"" + info_1.transaction.id + "\" could not be found");
                        return [2 /*return*/];
                    }
                    user = database.users.find(function (item) { return item.id === verification_2.userId; });
                    // the user should exist at this point
                    if (!user) {
                        throw new Error("Verification user with id \"" + verification_2.userId + "\" not found, this should not happen");
                    }
                    // store the verification info
                    verification_2.info = info_1;
                    // check that the verified user matches logged-in user
                    verification_2.isCorrectUser = isCorrectUser(verification_2.info, user);
                    // log callback info
                    console.log("received valid callback", {
                        body: request.body,
                        info: info_1,
                        verification: verification_2,
                        user: user,
                    });
                    successOdds = 1 / 2;
                    maxSimulatedLatency = 2000;
                    // roll the dice and send failure response half of the times to test the retry logic
                    if (Math.random() < successOdds) {
                        simulatedLatency = Math.random() * maxSimulatedLatency;
                        setTimeout(function () {
                            // respond with HTTP 2xx response code to be considered valid handled callback
                            response.send("OK");
                        }, simulatedLatency);
                    }
                    else {
                        // respond with non 2xx to be considered failed delivery attempt, the status delivery will be retried
                        response.status(500).send("Simulated internal error");
                    }
                }
                catch (error) {
                    console.log("received invalid callback", {
                        body: request.body,
                        error: error,
                    });
                    response
                        .status(400)
                        .send("Invalid JWT token provided (" + error.message + ")");
                }
                return [2 /*return*/];
            });
        }); });
        server = config.ssl.enabled
            ? https.createServer({
                cert: fs.readFileSync(config.ssl.cert),
                key: fs.readFileSync(config.ssl.key),
            }, app)
            : http.createServer(app);
        // start the server
        server.listen(config.port, function () {
            console.log("Example integration server started on port " + config.port);
            // also start a server on http to redirect to https if SSL is enabled
            if (config.ssl.enabled) {
                express_1.default()
                    .use(function (request, response, _next) {
                    response.redirect("https://" + config.host + request.originalUrl);
                })
                    .listen(80);
            }
        });
        return [2 /*return*/];
    });
}); })().catch(function (error) { return console.error(error); });
// returns whether verified user matches the correct (logged in) user
function isCorrectUser(verification, user) {
    // consider not valid if identity verification has not been performed
    if (verification.identityVerification === null) {
        return false;
    }
    // require first name to match (case-insensitive)
    if (verification.identityVerification.idFirstName === null ||
        verification.identityVerification.idFirstName === "N/A" ||
        user.firstName.toLowerCase() !==
            verification.identityVerification.idFirstName.toLowerCase()) {
        return false;
    }
    // require last name to match (case-insensitive)
    if (verification.identityVerification.idLastName === null ||
        verification.identityVerification.idLastName === "N/A" ||
        user.lastName.toLowerCase() !==
            verification.identityVerification.idLastName.toLowerCase()) {
        return false;
    }
    // name matches, all good (integrator could choose to verify additional known info such as date of birth etc)
    return true;
}
// debugging helper, renders data as formatted json
function debug(data) {
    return html_literal_1.default(templateObject_2 || (templateObject_2 = __makeTemplateObject([" <pre>", "</pre> "], [" <pre>", "</pre> "])), JSON.stringify(data, null, "  "));
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=index.js.map