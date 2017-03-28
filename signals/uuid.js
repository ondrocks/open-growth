opengrowth.signals.uuid = ( request, customer ) => {
    const user = request.message;
    const csm  = user.csm || {};
    const csm_bccs = csm && csm.bccs ? csm.bccs : [];
    let email  = user.litmus || 'open-growth-activity+silver@pubnub.com';
    // @if GOLD
    //email = user.email;
    // @endif

    let firstName    = opengrowth.customer.getFirstName(customer);
    let lastName     = opengrowth.customer.getLastName(customer);
    let company_name = opengrowth.customer.getCompany(customer);
    let uuid_count   = user.uuid_count || "0";
    let ip_count     = user.ip_count || "0";

    var template_data = {
        "customer_first_name" : firstName
      , "customer_last_name"  : lastName
      , "company_name"        : company_name
      , "csm_first_name"      : csm.first_name
      , "csm_last_name"       : csm.last_name
      , "csm_email"           : csm.email
      , "csm_phone"           : csm.phone
      , "csm_bccs"            : csm_bccs
      , "app_name"            : user.app_name
      , "uuid_count"          : uuid_count.toString()
      , "ip_count"            : ip_count.toString()
    };

    let lw = opengrowth.keys.sendgrid.group.limit_warning;
    let df = opengrowth.keys.sendgrid.group.default;
    let fe = opengrowth.keys.sendgrid.group.feature_enable;

    var sendWithUsPostBody = {
      "template": opengrowth.keys.swu.templates.uuid,
      "recipient": {
        "name": firstName,
        "address": email
      },
      "template_data": template_data,
      "bcc": csm_bccs,
      "tags" : [ "og_uuid" ],
      "headers" : {
        "x-smtpapi" : `{\"asm_group_id\":${fe},\"asm_groups_to_display\": [${lw},${df},${fe}]}`
      }
    };

    return opengrowth.delight.sendwithus.email(sendWithUsPostBody);
};