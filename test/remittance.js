var Remittance = artifacts.require("./Remittance.sol");

contract('Remittance', function(accounts) {
    it("should be enabled with owner accounts[0]", function() {
        var contract;

        return Remittance.deployed().then(function(instance) {
            contract = instance;
            return contract.isServiceEnabled.call();
        }).then(success => {
            assert.isTrue(success, "Service not enabled");
            return contract.owner.call();
        }).then(result => {
            assert.equal(result, accounts[0], "unknown account used to deploy, accounts[0] expected");
        });
    });

	it("should accept new exchange accounts", function() {
        var contract;

        return Remittance.deployed().then(function(instance) {
            contract = instance;
            return contract.enrollFiatExchange(accounts[1], { from: accounts[0] });
        }).then(txInfo => {
            console.log("here");
            return contract.exchanges.call(accounts[1]);
        }).then(success => {
            assert.isTrue(success, true, "accounts[1] enrolled as exchange");
        });
    });
});