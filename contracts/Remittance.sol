pragma solidity ^0.4.17;

contract Remittance {

    //admin-related
    address public owner;
    bool public isServiceEnabled;

    //general operation
    event ExchangeAdded (
        address exchangeAddress
    );
    mapping(address => bool) public exchanges;
    mapping(bytes32 => bool) public previousPasswords;

    //complex types - general operation
    struct Deposit {
        address originee;
        uint amount;
        uint deadlineBlockNumber;
        bytes32 passwordHash;
        bool extant;
    }
    event DepositPaid(
        uint contractInitialBalance,
        uint amountToPay,
        address recipient
    );
    
    mapping(bytes32 => Deposit) public deposits;

    function Remittance() public {
        owner = msg.sender;
        isServiceEnabled = true;
    }

    modifier checkEnabled {
        require(isServiceEnabled);
        _;
    }

    function setEnabled(bool enabled) public returns (bool) {
        require(msg.sender == owner);
        isServiceEnabled = enabled;
    }

    function enrollFiatExchange(address exchangeOperator) checkEnabled public returns (bool) {
        if (msg.sender == owner) {
            exchanges[exchangeOperator] = true;
            ExchangeAdded(exchangeOperator);
            return true;
        } else {
            return false;
        }
    }

    function receiveRemittance(uint deadlineBlocksInFuture, address exchangeToUse, bytes32 passwordHash) checkEnabled public payable {
        require(exchanges[exchangeToUse] == true && previousPasswords[passwordHash] == false && deposits[passwordHash].extant == false && msg.value > 0);
        Deposit memory newDeposit;

        newDeposit.originee = msg.sender;
        newDeposit.amount = msg.value;
        newDeposit.deadlineBlockNumber = block.number + deadlineBlocksInFuture;
        newDeposit.passwordHash = passwordHash;
        newDeposit.extant = true;

        deposits[passwordHash] = newDeposit;
        previousPasswords[passwordHash] = true;
    }

    function payoutRemittance(string password) checkEnabled public returns (bool) {
        bytes32 pwHash = keccak256(password);

        Deposit memory deposit = deposits[pwHash];
        if (deposit.extant) {
            //check reclaim first
            if (msg.sender == deposit.originee && block.number >= deposit.deadlineBlockNumber) {
                clearDeposit(pwHash);
                msg.sender.transfer(deposit.amount);
                DepositPaid(this.balance, deposit.amount, msg.sender);
                return true;
            } else if (exchanges[msg.sender] == true) { //next check if this remittance is being paid out normally
                clearDeposit(pwHash);
                msg.sender.transfer(deposit.amount);
                DepositPaid(this.balance, deposit.amount, msg.sender);
                return true;
            }
        }
        return false;
    }

    function clearDeposit(bytes32 pwHash) checkEnabled private {
        deposits[pwHash].originee = 0;
        deposits[pwHash].amount = 0;
        deposits[pwHash].deadlineBlockNumber = 0;
        deposits[pwHash].passwordHash = 0;
        deposits[pwHash].extant = false;
    }
}