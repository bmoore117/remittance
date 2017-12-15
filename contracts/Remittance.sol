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

    function enrollFiatExchange(address exchangeOperator) checkEnabled public returns (bool) {
        if (msg.sender == owner) {
            exchanges[exchangeOperator] = true;
            LogExchangeAdded(exchangeOperator);
            return true;
        } else {
            return false;
        }
    }

    function receiveRemittance(uint reclaimByBlock, address exchangeToUse, bytes32 passwordHash) checkEnabled public payable {
        require(exchanges[exchangeToUse] == true && previousPasswords[passwordHash] == false && msg.value > 0);
        Deposit memory newDeposit;

        newDeposit.originee = msg.sender;
        newDeposit.amount = msg.value;
        newDeposit.reclaimByBlock = block.number + reclaimByBlock;

        deposits[passwordHash] = newDeposit;
        previousPasswords[passwordHash] = true;
    }

    function payoutRemittance(string password) checkEnabled public returns (bool) {
        bytes32 pwHash = keccak256(password);

        Deposit memory deposit = deposits[pwHash];
        if (deposit.amount > 0) { //or in other words, if deposit exists
            //check reclaim first
            if (msg.sender == deposit.originee && block.number >= deposit.reclaimByBlock) {
                clearDeposit(pwHash);
                msg.sender.transfer(deposit.amount);
                LogDepositReclaimed(deposit.amount, msg.sender);
                return true;
            } else if (exchanges[msg.sender] == true) { //next check if this remittance is being paid out normally
                clearDeposit(pwHash);
                msg.sender.transfer(deposit.amount);
                LogDepositPaid(deposit.amount, msg.sender);
                return true;
            }
        }
        return false;
    }

    function clearDeposit(bytes32 pwHash) checkEnabled private {
        deposits[pwHash].originee = 0;
        deposits[pwHash].amount = 0;
        deposits[pwHash].reclaimByBlock = 0;
    }
}