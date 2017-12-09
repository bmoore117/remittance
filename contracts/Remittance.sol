pragma solidity ^0.4.17;

contract Remittance {

    //admin-related
    address public owner;
    bool serviceEnabled;

    //general operation
    mapping(address => bool) exchanges;
    mapping(bytes32 => bool) previousPasswords;

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
    }

    function receiveRemittance(uint deadlineBlocksInFuture, bytes32 passwordHash) checkEnabled public payable {
        if (previousPasswords[passwordHash] == false && deposits[passwordHash].extant == false) {
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

    function payoutRemittance(string password)  checkEnabled public payable returns (bool) {
        bytes32 pwHash = keccak256(password);

        Deposit memory deposit = deposits[pwHash];
        if (deposit.extant) {
            //check reclaim first
            if (msg.sender == deposit.originee && block.number <= deposit.deadlineBlockNumber) {
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