# Remittance
This repo stores the small project of the same name from the B9Labs ethereum development course. It was developed using Ganache from the Truffle suite, which will by default generate accounts with enough ether in them to make the tests work. `truffle.js` is also configured to point to a default Ganache installation.

Following instructor review and comments, the contract has been improved and the tests in particular have been tightened up and reworked with `describe`, `before` and `beforeEach` functions, and can now be run repeatedly so long as the test accounts have enough ether in them. Ganache still provides the easiest way to do this.