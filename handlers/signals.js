// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// Open Growth Framework
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
var opengrowth = {};

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// Libs
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
const xhr      = require('xhr');
const kvdb     = require('kvstore');
const auth     = require('codec/auth');
const base64   = require('codec/base64');
const crypto   = require('crypto');
const pubnub   = require('pubnub');
const query    = require('codec/query_string');

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// Open Growth Signals Event Handler - Before Publish or Fire
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
export default ( request ) => {
    // Accept incoming email analytics from SendGrid.com
    // move the POST body to the "actions" property in the message
    if ( request.params.sendgrid_analytics ) {
        request.message = {
            "signal"  : "sendgrid_updates",
            "actions" : request.message.slice(0)
        };
    }

    // @if ENV != 'Gold'
    // No deduplication on testing envs
    // Must be explicitly set to false to disable deduplication
    if ( request.message.dedupe !== true ) {
        request.message.dedupe = false;
    }
    // @endif

    const message = request.message;
    const signal  = message.signal;
    const email   = message.email;

    let initialCustomerData = {
        "email"       : message.email,
        "firstName"   : message.firstName,
        "lastName"    : message.lastName,
        "phone"       : message.phone,
        "company"     : message.company,
        "description" : message.description,
        "useCase"     : message.useCase
    };

    // Where logs are stored during this EH execution
    opengrowth.logs = [];

    // Real-time monitoring updates configured for Librato by default
    opengrowth.rtmUpdates = {};

    // Record the signal, pass message by copy
    opengrowth.track.signal(signal, Object.assign({}, message));

    // Track in-line Processed Flag
    request.message.processed = { started: true };

    // Common tasks to perform at the end of this event handler
    let done = () => {
        request.message.logs = opengrowth.logs;
        request.message.rtmUpdates = opengrowth.rtmUpdates;
        request.message.processed.completed = true;
        return request.ok();
    };

    // If there is no email address, we can't enrich with Clearbit
    // Continue to the After Event Handler
    if ( !email ) {
        return done();
    }

    // Enrich the Customer Data with Clearbit,
    // Attempt to determine the company's Use Case using MonkeyLearn
    let customer = {};

    // Check for duplicate signal to prevent customers
    // receiving duplicate delights
    return kvdb.get(`delight-${signal}-${email}`)
    .then( ( duplicate ) => {
        request.message.kvRecord = duplicate;
        if ( duplicate && !( message.dedupe === false ) ) {
            // Abort, this is a duplicate delight signal
            // the After EH will record activity
            opengrowth.log("signals", "duplicate", "duplicate_delight", true);
            throw 'Duplicate Customer Delight!';
        }
        else {
            // Clearbit lookup
            return opengrowth.customer.clearbitLookup(email);
        }
    })
    .then( ( clearbitCustomerData ) => {
        // Enrich the customer object with Clearbit data
        customer = opengrowth.customer.enrich(
            initialCustomerData,
            clearbitCustomerData
        );

        // Find a Use Case with MonkeyLearn if 
        // any company description is available
        return opengrowth.customer.getUseCase(customer);
    })
    .then( ( useCase ) => {

        // Set use case if MonkeyLearn determined it
        if ( useCase ) {
            customer.useCase = useCase;
        }
        
        // Store customer data in message body
        request.message.customer = customer;

        return done();
    })
    .catch(done);
};

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// Modules that Augment and Enhance with ML and AI
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
opengrowth.modules = {};
