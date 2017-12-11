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

	it("should accept new exchange accounts if submitted by the owner", function() {
        var contract;

        return Remittance.deployed().then(function(instance) {
            contract = instance;
            return contract.enrollFiatExchange(accounts[1], {from: accounts[0]});
        }).then(txInfo => {
            return contract.exchanges.call(accounts[1]);
        }).then(success => {
            assert.isTrue(success, true, "accounts[1] registered as exchange");
        });
    });

    it("should reject new exchange accounts if not submitted by the owner", function() {
        var contract;

        return Remittance.deployed().then(function(instance) {
            contract = instance;
            return contract.enrollFiatExchange(accounts[2], {from: accounts[1]});
        }).then(txInfo => {
            return contract.exchanges.call(accounts[1]);
        }).then(success => {
            assert.isTrue(success, false, "non-owner account successfully added an exchange");
        });
    });

    it("should accept non-zero-valued deposits submitted with globally-unique passwords to registered exchanges", function() {
        var contract;
        var pwHash;
        
        return Remittance.deployed().then(function(instance) {
            contract = instance;
            pwHash = web3.sha3("password1");
            return contract.receiveRemittance(3, accounts[1], pwHash, {from: accounts[2], value: 10});
        }).then(txInfo => {
            return contract.deposits.call(pwHash);
        }).then(deposit => {
            assert.isTrue(deposit[4], true, "Deposit not successfully created");
        });
    });

    it("should reject zero-valued deposits submitted with globally-unique passwords to registered exchanges", function() {
        var contract;
        var pwHash;
        
        return Remittance.deployed().then(function(instance) {
            contract = instance;
            pwHash = web3.sha3("password2");
            return contract.receiveRemittance(3, accounts[1], pwHash, {from: accounts[3]});
        }).catch(txInfo => {
            return contract.deposits.call(pwHash);
        }).then(deposit => {
            assert.isFalse(deposit[4], false, "Zero-valued deposit created");
        });
    });

    it("should reject non-zero valued deposits submitted without globally-unique passwords to registered exchanges", function() {
        var contract;
        var pwHash;
        
        return Remittance.deployed().then(function(instance) {
            contract = instance;
            pwHash = web3.sha3("password1");
            return contract.receiveRemittance(3, accounts[1], pwHash, {from: accounts[4], value: 20});
        }).catch(txInfo => {
            return contract.deposits(pwHash);
        }).then(deposit => {
            assert.equal(accounts[2], deposit[0], "Deposit with previously seen password created");
        });
    });

    it("should reject non-zero valued deposits submitted with globally-unique passwords to non-registered exchanges", function() {
        var contract;
        var pwHash;
        
        return Remittance.deployed().then(function(instance) {
            contract = instance;
            pwHash = web3.sha3("password3");
            return contract.receiveRemittance(3, accounts[2], pwHash, {from: accounts[4], value: 30});
        }).catch(txInfo => {
            return contract.deposits(pwHash);
        }).then(deposit => {
            assert.isFalse(deposit[4], false, "Deposit using a non-registered exchange created");
        });
    });
});