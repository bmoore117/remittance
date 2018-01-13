pragma solidity ^0.4.17;

contract Remittance {

    //admin-related
    address public owner;
    bool public isServiceEnabled;
    event LogServiceStateChanged(
        bool newState
    );

    //general operation
    event LogExchangeAdded (
        address exchangeAddress
    );
    mapping(address => bool) public exchanges;
    mapping(bytes32 => bool) public previousPasswords;

    //complex types - general operation
    struct Deposit {
        address originee;
        address claimant;
        uint amount;
        uint reclaimByBlock;
    }
    event LogDepositPaid(
        uint paidAmount,
        address recipient
    );
    event LogDepositReclaimed(
        uint reclaimedAmount,
        address recipient
    );
    mapping(bytes32 => Deposit) public deposits;

    /** End variables, begin code */

    function Remittance(bool initialServiceState) public {
        owner = msg.sender;
        isServiceEnabled = initialServiceState;
    }

    modifier checkEnabled {
        require(isServiceEnabled);
        _;
    }

    function setEnabled(bool enabled) public returns (bool) {
        require(msg.sender == owner);
        isServiceEnabled = enabled;
        LogServiceStateChanged(isServiceEnabled);
        return isServiceEnabled;
    }

    function enrollFiatExchange(address exchangeOperator) checkEnabled public {
        require(msg.sender == owner);
        exchanges[exchangeOperator] = true;
        LogExchangeAdded(exchangeOperator);
    }

    function receiveRemittance(uint reclaimByBlock, address exchangeToUse, bytes32 passwordHash) checkEnabled public payable {
        require(exchanges[exchangeToUse] && !previousPasswords[passwordHash] && msg.value > 0);
        Deposit memory newDeposit;

        newDeposit.originee = msg.sender;
        newDeposit.claimant = exchangeToUse;
        newDeposit.amount = msg.value;
        newDeposit.reclaimByBlock = block.number + reclaimByBlock;

        deposits[passwordHash] = newDeposit;
        previousPasswords[passwordHash] = true;
    }

    function payoutRemittance(string password) checkEnabled public {
        bytes32 pwHash = getHash(password);

        Deposit memory deposit = deposits[pwHash];
        require(deposit.amount > 0 && (msg.sender == deposit.originee || msg.sender == deposit.claimant));
        //check reclaim first
        if (msg.sender == deposit.originee && block.number >= deposit.reclaimByBlock) {
            clearDeposit(pwHash);
            LogDepositReclaimed(deposit.amount, msg.sender);
            msg.sender.transfer(deposit.amount);
        } else { //msg.sender == deposit.claimant - all other conditions have been checked
            clearDeposit(pwHash);
            LogDepositPaid(deposit.amount, msg.sender);
            msg.sender.transfer(deposit.amount);
        }
    }

    function clearDeposit(bytes32 pwHash) private {
        deposits[pwHash].originee = 0;
        deposits[pwHash].claimant = 0;
        deposits[pwHash].amount = 0;
        deposits[pwHash].reclaimByBlock = 0;
    }

    /* 
    Putting this here allows tests to work with the exact same hashing algorithm as the contract itself
    */
    function getHash(string password) checkEnabled public view returns (bytes32) {
        return keccak256(password);
    }
}