// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @title InterbankTransfer
 * @dev Smart contract quản lý giao dịch liên ngân hàng
 * - Quản lý số dư của từng bank
 * - Xử lý chuyển tiền liên ngân hàng
 * - Phát events để thông báo
 * - Theo dõi trạng thái giao dịch
 */
contract InterbankTransfer {
    // Mapping từ address đến số dư (VND, nhưng lưu dưới dạng wei)
    mapping(address => uint256) public balances;
    
    // Mapping từ address đến bank code
    mapping(address => string) public bankCodes;
    
    // Struct cho giao dịch
    struct Transaction {
        uint256 id;
        address from;
        address to;
        uint256 amount; // in wei (số dư thực tế)
        string fromBank;
        string toBank;
        string description;
        uint256 timestamp;
        TransactionStatus status;
    }
    
    // Enum cho trạng thái giao dịch
    enum TransactionStatus {
        Pending,
        Processing,
        Completed,
        Failed
    }
    
    // Mảng các giao dịch
    Transaction[] public transactions;
    
    // Mapping từ transaction ID đến index trong mảng
    mapping(uint256 => uint256) public transactionIndex;
    
    // Events
    event Deposit(address indexed user, uint256 amount, string bankCode);
    event Transfer(
        uint256 indexed transactionId,
        address indexed from,
        address indexed to,
        uint256 amount,
        string fromBank,
        string toBank,
        string description,
        uint256 timestamp
    );
    event TransactionStatusChanged(
        uint256 indexed transactionId,
        TransactionStatus status
    );
    event BalanceUpdated(address indexed user, uint256 newBalance);
    
    // Chỉ owner (hoặc authorized banks) mới có thể thực hiện một số hàm
    address public owner;
    mapping(address => bool) public authorizedBanks;
    
    // Counter cho transaction ID
    uint256 private transactionCounter;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            authorizedBanks[msg.sender] || msg.sender == owner,
            "Not authorized"
        );
        _;
    }
    
    constructor() {
        owner = msg.sender;
        transactionCounter = 0;
    }
    
    /**
     * @dev Thêm bank được ủy quyền
     */
    function addAuthorizedBank(address bankAddress, string memory bankCode)
        public
        onlyOwner
    {
        authorizedBanks[bankAddress] = true;
        bankCodes[bankAddress] = bankCode;
    }
    
    /**
     * @dev Nạp tiền vào tài khoản (chỉ authorized banks)
     */
    function deposit(address user, string memory bankCode)
        public
        payable
        onlyAuthorized
    {
        require(user != address(0), "Invalid user address");
        require(msg.value > 0, "Amount must be greater than 0");
        
        balances[user] += msg.value;
        bankCodes[user] = bankCode;
        
        emit Deposit(user, msg.value, bankCode);
        emit BalanceUpdated(user, balances[user]);
    }
    
    /**
     * @dev Lấy số dư của một address
     */
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    /**
     * @dev Chuyển tiền liên ngân hàng
     * @param to Địa chỉ người nhận
     * @param amount Số tiền (trong wei)
     * @param toBankCode Mã ngân hàng nhận
     * @param description Mô tả giao dịch
     * @return transactionId ID của giao dịch
     */
    function transfer(
        address to,
        uint256 amount,
        string memory toBankCode,
        string memory description
    ) public returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(
            balances[msg.sender] >= amount,
            "Insufficient balance"
        );
        
        // Tạo transaction mới
        transactionCounter++;
        uint256 txId = transactionCounter;
        
        Transaction memory newTx = Transaction({
            id: txId,
            from: msg.sender,
            to: to,
            amount: amount,
            fromBank: bankCodes[msg.sender],
            toBank: toBankCode,
            description: description,
            timestamp: block.timestamp,
            status: TransactionStatus.Pending
        });
        
        transactions.push(newTx);
        transactionIndex[txId] = transactions.length - 1;
        
        // Cập nhật số dư
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Cập nhật trạng thái
        transactions[transactions.length - 1].status = TransactionStatus.Completed;
        
        // Phát events
        emit Transfer(
            txId,
            msg.sender,
            to,
            amount,
            bankCodes[msg.sender],
            toBankCode,
            description,
            block.timestamp
        );
        emit TransactionStatusChanged(txId, TransactionStatus.Completed);
        emit BalanceUpdated(msg.sender, balances[msg.sender]);
        emit BalanceUpdated(to, balances[to]);
        
        return txId;
    }
    
    /**
     * @dev Lấy thông tin giao dịch
     */
    function getTransaction(uint256 txId)
        public
        view
        returns (
            uint256 id,
            address from,
            address to,
            uint256 amount,
            string memory fromBank,
            string memory toBank,
            string memory description,
            uint256 timestamp,
            TransactionStatus status
        )
    {
        require(txId > 0 && txId <= transactionCounter, "Invalid transaction ID");
        uint256 index = transactionIndex[txId];
        Transaction memory transaction = transactions[index];
        
        return (
            transaction.id,
            transaction.from,
            transaction.to,
            transaction.amount,
            transaction.fromBank,
            transaction.toBank,
            transaction.description,
            transaction.timestamp,
            transaction.status
        );
    }
    
    /**
     * @dev Lấy tổng số giao dịch
     */
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }
    
    /**
     * @dev Lấy danh sách giao dịch của một user (sender hoặc receiver)
     */
    function getUserTransactions(address user)
        public
        view
        returns (uint256[] memory)
    {
        uint256 count = 0;
        
        // Đếm số giao dịch
        for (uint256 i = 0; i < transactions.length; i++) {
            if (
                transactions[i].from == user ||
                transactions[i].to == user
            ) {
                count++;
            }
        }
        
        // Tạo mảng kết quả
        uint256[] memory userTxs = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < transactions.length; i++) {
            if (
                transactions[i].from == user ||
                transactions[i].to == user
            ) {
                userTxs[index] = transactions[i].id;
                index++;
            }
        }
        
        return userTxs;
    }
    
    /**
     * @dev Cập nhật trạng thái giao dịch (chỉ owner hoặc authorized banks)
     */
    function updateTransactionStatus(
        uint256 txId,
        TransactionStatus status
    ) public onlyAuthorized {
        require(txId > 0 && txId <= transactionCounter, "Invalid transaction ID");
        uint256 index = transactionIndex[txId];
        transactions[index].status = status;
        
        emit TransactionStatusChanged(txId, status);
    }
}

