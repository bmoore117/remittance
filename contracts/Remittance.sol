pragma solidity ^0.4.17;

contract Remittance {

    //admin-related
    address public owner;
    bool serviceEnabled;

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
    mapping(bytes32 => Deposit) deposits;

    function Remittance() public {
        owner = msg.sender;
        serviceEnabled = true;
    }

    modifier checkEnabled {
        require(serviceEnabled);
        _;
    }

    function setEnabled(bool enabled) public returns (bool) {
        require(msg.sender == owner);
        serviceEnabled = enabled;
    }

    function enrollFiatExchange(address exchangeOperator) checkEnabled public {
        require(msg.sender == owner);
        exchanges[exchangeOperator] = true;
        ExchangeAdded(exchangeOperator);
    }

    function receiveRemittance(uint deadlineBlocksInFuture, address exchangeToUse, bytes32 passwordHash) checkEnabled public payable {
        if (exchanges[exchangeToUse] == true && previousPasswords[passwordHash] == false && deposits[passwordHash].extant == false) {
            Deposit memory newDeposit;

            newDeposit.originee = msg.sender;
            newDeposit.amount = msg.value;
            newDeposit.deadlineBlockNumber = block.number + deadlineBlocksInFuture;
            newDeposit.passwordHash = passwordHash;
            newDeposit.extant = true;

            deposits[passwordHash] = newDeposit;
            previousPasswords[passwordHash] = true;
        } else {
            revert();
        }
    }

    function payoutRemittance(string password) checkEnabled public returns (bool) {
        bytes32 pwHash = keccak256(password);

        Deposit memory deposit = deposits[pwHash];
        if (deposit.extant) {
            //check reclaim first
            if (msg.sender == deposit.originee && block.number >= deposit.deadlineBlockNumber) {
                msg.sender.transfer(deposit.amount);
                return true;
            } else if (exchanges[msg.sender] == true) { //next check if this remittance is being paid out normally
                msg.sender.transfer(deposit.amount);
                return true;
            }
        }
        return false;
    }
}