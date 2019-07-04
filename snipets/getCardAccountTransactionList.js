var accountId = apim.getvariable('request.parameters.account-id');

var userId = "";
if (apim.getvariable('request.authorization')) {
    userId = apim.getvariable('oauth.resource-owner');
}

apim.readInputAsJSON(function(err, bankData) {
    var result = {};
    try {
        var myAccountsInfo = bankData.allAccounts.find(item => item.id === userId);
        var myCardAccounts = myAccountsInfo.cardAccountsData;
        var reqCardAccount = myCardAccounts.cardAccounts.find(item => item.resourceId === accountId);
        var reqAccountMaskedPan = reqCardAccount.maskedPan;
        result = myAccountsInfo.cardAccountsTransactions.find(item => item.cardAccount.maskedPan === reqAccountMaskedPan);

        if (!result) {
            result = {};
        }
    } catch (e) {
        result = e;
    }

    apim.output('application/json');
    session.output.write(JSON.stringify(result, null, 2));
});