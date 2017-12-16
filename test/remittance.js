var p = require("bluebird");
const getBalancePromise = p.promisify(web3.eth.getBalance);

const Remittance = artifacts.require("./Remittance.sol");

contract('Remittance', function(accounts) {
    it("should be enabled with owner accounts[0]", function() {
        var instance;

        return Remittance.deployed().then(function(_instance) {
            instance = _instance;
            return instance.isServiceEnabled.call();
        }).then(success => {
            assert.isTrue(success, "Service not enabled");
            return instance.owner.call();
        }).then(result => {
            assert.strictEqual(result, accounts[0], "unknown account used to deploy, accounts[0] expected");
        });
    });

	it("should accept new exchange accounts if submitted by the owner", done => {
        Remittance.deployed().then(function(instance) {
            var tx = instance.enrollFiatExchange(accounts[1], {from: accounts[0]});
            
            // positive case - if tx is not reverted
            tx.then(txInfo => {
                logs = txInfo.logs[0];
                var eventType = logs.event;
                var address = logs.args.exchangeAddress;
                
                var result = eventType === 'LogExchangeAdded' && address === accounts[1];
                assert.isTrue(result, 'accounts[1] not registered as exchange');
                done();
            });

            // negative case - tx is reverted
            tx.catch(err => {
                done(err);
            });
        });
    });

     it("should reject new exchange accounts if not submitted by the owner", done => {
        var instance;

        Remittance.deployed().then(function(_instance) {
            instance = _instance;
            var tx = instance.enrollFiatExchange(accounts[2], {from: accounts[1]});
            
            tx.then(txInfo => {
                return instance.exchanges.call(accounts[2]);
            }).then(success => {
                assert.isTrue(success, "non-owner account successfully added an exchange");
                done();
            });

            tx.catch(err => {
                done();
            });
        });
    });

    it("should accept non-zero-valued deposits submitted with globally-unique passwords to registered exchanges", done => {
        var instance;
        var pwHash;
        
        var remittanceTx = Remittance.deployed().then(function(_instance) {
            instance = _instance;
            pwHash = web3.sha3("password1");
            var value = web3.toWei(1, "ether");
            return instance.receiveRemittance(3, accounts[1], pwHash, {from: accounts[2], value: value});
        });

        remittanceTx.then(txInfo => {
            return instance.deposits.call(pwHash);
        }).then(deposit => {
            assert.isTrue(deposit[1] > 0, true, "Deposit not successfully created");
            done();
        });

        remittanceTx.catch(err => {
            done(err);
        })
    });

    it("should reject zero-valued deposits submitted with globally-unique passwords to registered exchanges", function() {
        var instance;
        var pwHash;
        
        return Remittance.deployed().then(function(_instance) {
            instance = _instance;
            pwHash = web3.sha3("password2");
            return instance.receiveRemittance(3, accounts[1], pwHash, {from: accounts[3]});
        }).catch(txInfo => {
            return instance.deposits.call(pwHash);
        }).then(deposit => {
            assert.isFalse(deposit[1] > 0, false, "Zero-valued deposit created");
        });
    });

    it("should reject non-zero valued deposits submitted without globally-unique passwords to registered exchanges", function() {
        var instance;
        var pwHash;
        
        return Remittance.deployed().then(function(_instance) {
            instance = _instance;
            pwHash = web3.sha3("password1");
            return instance.receiveRemittance(3, accounts[1], pwHash, {from: accounts[4], value: 20});
        }).catch(txInfo => {
            return instance.deposits(pwHash);
        }).then(deposit => {
            assert.strictEqual(accounts[2], deposit[0], "Deposit with previously seen password created");
        });
    });

    it("should reject non-zero valued deposits submitted with globally-unique passwords to non-registered exchanges", function() {
        var instance;
        var pwHash;
        
        return Remittance.deployed().then(function(_instance) {
            instance = _instance;
            pwHash = web3.sha3("password3");
            return instance.receiveRemittance(3, accounts[2], pwHash, {from: accounts[4], value: 30});
        }).catch(txInfo => {
            return instance.deposits(pwHash);
        }).then(deposit => {
            assert.isFalse(deposit[1] > 0, false, "Deposit using a non-registered exchange created");
        });
    });

    it("should have a balance equal to the payout amounts in each deposit", function() {
        var instance;
        var contractBalance;

        return Remittance.deployed().then(function(_instance) {
            instance = _instance;
            return getBalancePromise(instance.address);
        }).then(balance => {
            contractBalance = balance;
            var pwHash = web3.sha3("password1");
            return instance.deposits.call(pwHash);
        }).then(deposit => {
            // == doesn't seem to work to compare, === doesn't seem to work to compare either, so going with subtraction
            var result = deposit[1] - contractBalance; 
            assert.strictEqual(0, result, "instance's balance not in agreement with stated deposits");
        });
    });

    //TODO: figure out fee system such that we can determine exactly how much of the remittance the final recipient will receive
    it("should pay out deposits with a correct password to an approved exchange", function() {
        var instance;
        var amountBeforePayout;
        var amountAfterPayout;

        return Remittance.deployed().then(function(_instance) {
            instance = _instance;
            return getBalancePromise(accounts[1]); //exchange's account
        }).then(balance => {
            amountBeforePayout = balance;
            return instance.payoutRemittance("password1", { from: accounts[1] });
        }).then(txInfo => {
            return getBalancePromise(accounts[1]);
        }).then(balance => {
            var amountAfterPayout = balance;
            assert.isTrue(amountAfterPayout - amountBeforePayout > 0, true, "Remittance not properly paid out");
        });
    });
});