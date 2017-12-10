var Remittance = artifacts.require("./Remittance.sol");

contract('Remittance', function(accounts) {
	it("should accept new exchange accounts", function() {
        var contract;

        return Remittance.deployed().then(function(instance) {
            contract = instance;
            return contract.enrollFiatExchange(accounts[1], { from: accounts[0] });
        }).then(txInfo => {
            return contract.exchanges.call(accounts[1]);
        }).then(success => {
            assert.isTrue(success, true, "accounts[1] enrolled as exchange");
        });
    });
});