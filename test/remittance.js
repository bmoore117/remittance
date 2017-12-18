var p = require("bluebird");
const getBalancePromise = p.promisify(web3.eth.getBalance);
const getTransactionPromise = p.promisify(web3.eth.getTransaction);

const Remittance = artifacts.require("./Remittance.sol");

contract('Remittance', function(accounts) {
    describe("deployment", function() {
        var instance;

        before("deploy new instance", function() {
            return Remittance.new(true, {from: accounts[0]})
            .then(function(_instance) {
                instance = _instance;
            });
        });

        it("should be enabled with owner accounts[0]", function() {
            return instance.isServiceEnabled.call()
            .then(success => {
                assert.isTrue(success, "Service not enabled");
                return instance.owner.call();
            }).then(result => {
                assert.strictEqual(result, accounts[0], "unknown account used to deploy, accounts[0] expected");
            });
        });
    
        it("should accept new exchange accounts if submitted by the owner", done => {
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
    
        it("should reject new exchange accounts if not submitted by the owner", done => {
            var tx = instance.enrollFiatExchange(accounts[1], {from: accounts[1]});
                
            tx.then(txInfo => {
                return instance.exchanges.call(accounts[1]);
            }).then(success => {
                assert.isTrue(success, "non-owner account successfully added an exchange");
                done();
            });
    
            tx.catch(err => {
                done();
            });
        });
    });

    describe("making deposits", function() {
        var instance;
        
        before("deploy new instance", function() {
            return Remittance.new(true, {from: accounts[0]})
            .then(function(_instance) {
                instance = _instance;
                
                //unsatisfactory - would like to use the code from above to enroll exchange and handle failure
                //but would need the done callback, which before() doesn't supply. At any rate, if the earlier test fails
                //the rest of this set ain't gonna go well.
                return instance.enrollFiatExchange(accounts[1], {from: accounts[0]})
                .then(txInfo => {
                    logs = txInfo.logs[0];
                    var eventType = logs.event;
                    var address = logs.args.exchangeAddress;
                        
                    var result = eventType === 'LogExchangeAdded' && address === accounts[1];
                    assert.isTrue(result, 'accounts[1] not registered as exchange');
                });
            });
        });

        it("should accept non-zero-valued deposits submitted with globally-unique passwords to registered exchanges", done => {
            var value = web3.toWei(1, "ether");

            instance.getHash.call("password1").then(pwHash => {
                var remittanceTx = instance.receiveRemittance(3, accounts[1], pwHash, {from: accounts[2], value: value});
                remittanceTx.then(txInfo => {
                    return instance.deposits.call(pwHash);
                }).then(deposit => {
                    assert.isTrue(deposit[1] > 0, "Deposit not successfully created");
                    done();
                });
    
                remittanceTx.catch(err => {
                    done(err);
                });
            });
        });
    
        it("should reject zero-valued deposits submitted with globally-unique passwords to registered exchanges", done => {
            instance.getHash.call("password2").then(pwHash => {
                var tx = instance.receiveRemittance(3, accounts[1], pwHash, {from: accounts[2]});
                
                tx.then(txInfo => {
                    done("Expected invalid transaction to be rejected");
                });
                
                tx.catch(err => {
                    done();
                });
            });
        });
    
        it("should reject non-zero valued deposits submitted without globally-unique passwords to registered exchanges", done => {
            instance.getHash.call("password1").then(pwHash => {
                var tx = instance.receiveRemittance(3, accounts[1], pwHash, {from: accounts[2], value: 20});
                
                tx.then(txInfo => {
                    done("Expected invalid transaction to be rejected");
                });
                
                tx.catch(err => {
                    done();
                });
            });
        });
    
        it("should reject non-zero valued deposits submitted with globally-unique passwords to non-registered exchanges", done => {
            instance.getHash.call("password3").then(pwHash => {
                var tx = instance.receiveRemittance(3, accounts[2], pwHash, {from: accounts[2], value: 30});
                
                tx.then(txInfo => {
                    done("Expected invalid transaction to be rejected");
                });
                
                tx.catch(err => {
                    done();
                });
            });
        });
    
        it("should have a balance equal to the payout amounts in each deposit", function() {
            var contractBalance;

            return instance.getHash.call("password1").then(pwHash => {
                return getBalancePromise(instance.address)
                .then(balance => {
                    contractBalance = balance;
                    return instance.deposits.call(pwHash);
                }).then(deposit => {
                    // == doesn't seem to work to compare, === doesn't seem to work to compare either, so going with subtraction
                    var result = deposit[2].minus(contractBalance);
                    assert.strictEqual(0, result.toNumber(), "instance's balance not in agreement with stated deposits");
                });
            });
        });
    });


    describe("withdrawing deposits", function() {
        var instance;        

        beforeEach("deploy new instance and prepare with deposit", function() {
            return Remittance.new(true, {from: accounts[0]})
            .then(function(_instance) {
                instance = _instance;

                return instance.getHash.call("password1").then(pwHash => {
                    return instance.enrollFiatExchange(accounts[1], {from: accounts[0]})
                    .then(txInfo => {
                        logs = txInfo.logs[0];
                        var eventType = logs.event;
                        var address = logs.args.exchangeAddress;
    
                        var result = eventType === 'LogExchangeAdded' && address === accounts[1];
                        assert.isTrue(result, 'accounts[1] not registered as exchange');
                        
                        var value = web3.toWei(1, "ether");
                        return instance.receiveRemittance(3, accounts[1], pwHash, {from: accounts[2], value: value});
                    }).then(txInfo => {
                        return instance.deposits.call(pwHash);
                    }).then(deposit => {
                        assert.isTrue(deposit[1] > 0, "Deposit not successfully created");
                    });
                });
            });
        });

        it("should pay out deposits with a correct password to an approved exchange", function() {
            var amountBeforePayout;
            var gasUsed;
            var gasPrice;
    
            return getBalancePromise(accounts[1]) //exchange's initial balance
            .then(balance => {
                amountBeforePayout = balance;
                return instance.payoutRemittance("password1", { from: accounts[1] });
            }).then(txInfo => {
                payoutAmount = txInfo.logs[0].args.paidAmount;
                gasUsed = txInfo.receipt.gasUsed;                
                return getTransactionPromise(txInfo.tx);
            }).then(tx => {
                gasPrice = tx.gasPrice; //gas price from web3.eth.gasPrice is incorrect, this is the real one
                return getBalancePromise(accounts[1]);
            }).then(amountAfterPayout => {
                var payoutLessFees = payoutAmount.minus(gasUsed*gasPrice);
                var test = amountAfterPayout.minus(payoutLessFees);
        
                assert.strictEqual(test.toString(10), amountBeforePayout.toString(10), "Remittance not properly paid out");
            });
        });

        it("should not pay out deposits with an incorrect password to an approved exchange", done => {
            var tx = instance.payoutRemittance("password2", { from: accounts[1] });

            tx.then(txInfo => {
                done("Expected invalid transaction to be rejected");
            });
            
            tx.catch(err => {
                done();
            });
        });

        it("should not pay out deposits with a correct password to an unapproved exchange", done => {
            var tx = instance.payoutRemittance("password1", { from: accounts[3] });

            tx.then(txInfo => {
                done("Expected invalid transaction to be rejected");
            });
            
            tx.catch(err => {
                done();
            });
        });
    });
});