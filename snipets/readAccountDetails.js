var accountId = apim.getvariable('request.parameters.account-id');

var userId = "";
if (apim.getvariable('request.authorization')) {
    userId = apim.getvariable('oauth.resource-owner');
}

apim.readInputAsJSON(function(err, bankData) {
    var result = {};
    try {
        var myAccountsInfo = bankData.allAccounts.find(item => item.id === userId);
        var myAccounts = myAccountsInfo.accountsData;
        var reqAccount = myAccounts.accounts.find(item => item.resourceId === accountId);

        var withBalanceQuery = apim.getvariable('request.parameters.withBalance') || true;
        if (withBalanceQuery === "false") {
          delete reqAccount._links;
        }
        result.account = reqAccount;

        if (!result) {
            result = {};
        }
    } catch (e) {
        result = e;
    }

    apim.output('application/json');
    session.output.write(JSON.stringify(result, null, 2));
});
