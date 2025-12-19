// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @dev Interface for PKIRegistry contract
 */
interface IPKIRegistry {
    function isKYCValid(address _user) external view returns (bool);
    function canUserTransfer(address _user, uint256 _amount) external view returns (bool);
    function recordTransfer(address _user, uint256 _amount) external;
    function getUserPublicKey(address _user) external view returns (bytes memory);
}

/**
 * @dev Interface for BalanceVerifier contract
 */
interface IBalanceVerifier {
    struct BalanceProof {
        uint256 amount;
        bytes32 commitmentHash;
        bytes proofBytes;
        address userAddress;
    }
    
    function verifyProof(BalanceProof memory proof) external returns (bool);
    function isProofVerified(bytes32 proofHash) external view returns (bool);
}

/**
 * @dev Interface cho PQCSignatureRegistry contract
 */
interface IPQCSignatureRegistry {
    function storePQCSignature(
        uint256 txId,
        bytes calldata pqcSignature,
        string calldata algorithm
    ) external;
}

/**
 * @title InterbankTransfer
 * @dev Smart contract quản lý giao dịch liên ngân hàng với PKI integration.
 *
 * Thiết kế tối giản để không vượt giới hạn kích thước contract (EIP‑170):
 * - KHÔNG lưu toàn bộ lịch sử giao dịch on-chain (chỉ emit events `Transfer`).
 * - ZKP được verify off-chain (Winterfell), on-chain chỉ kiểm tra integrity inputs + gọi verifier tối giản.
 * - PQC signatures được lưu trong contract riêng `PQCSignatureRegistry` (Interbank chỉ gọi registry).
 */
contract InterbankTransfer {
    // PKI Registry reference
    IPKIRegistry public pkiRegistry;
    bool public pkiEnabled;
    
    // Balance Verifier reference (ZKP verifier)
    IBalanceVerifier public balanceVerifier;
    bool public zkpEnabled;
    
    // PQC Signature Registry reference (lưu chữ ký PQC on-chain)
    IPQCSignatureRegistry public pqcRegistry;
    
    // Mapping từ address đến số dư (VND, nhưng lưu dưới dạng wei)
    mapping(address => uint256) public balances;
    
    // Mapping từ address đến bank code
    mapping(address => string) public bankCodes;
    
    // Đếm số lượng giao dịch đã thực hiện (dùng làm transactionId trong event)
    uint256 public transactionCounter;
    
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
    event BalanceUpdated(address indexed user, uint256 newBalance);
    
    // Chỉ owner (hoặc authorized banks) mới có thể thực hiện một số hàm
    address public owner;
    mapping(address => bool) public authorizedBanks;
    
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
        pkiEnabled = false; // Will be enabled after PKI deployment
        zkpEnabled = false; // Will be enabled after BalanceVerifier deployment
    }
    
    /**
     * @dev Set PKI Registry address (only owner)
     */
    function setPKIRegistry(address _pkiRegistry) external onlyOwner {
        require(_pkiRegistry != address(0), "Invalid PKI address");
        pkiRegistry = IPKIRegistry(_pkiRegistry);
        pkiEnabled = true;
    }
    
    /**
     * @dev Toggle PKI enforcement
     */
    function togglePKI(bool _enabled) external onlyOwner {
        pkiEnabled = _enabled;
    }
    
    /**
     * @dev Set Balance Verifier address (only owner)
     */
    function setBalanceVerifier(address _balanceVerifier) external onlyOwner {
        require(_balanceVerifier != address(0), "Invalid verifier address");
        balanceVerifier = IBalanceVerifier(_balanceVerifier);
        zkpEnabled = true;
    }
    
    /**
     * @dev Set PQC Signature Registry address (only owner)
     */
    function setPQCRegistry(address _pqcRegistry) external onlyOwner {
        require(_pqcRegistry != address(0), "Invalid PQC registry address");
        pqcRegistry = IPQCSignatureRegistry(_pqcRegistry);
    }
    
    /**
     * @dev Toggle ZKP enforcement
     */
    function toggleZKP(bool _enabled) external onlyOwner {
        require(address(balanceVerifier) != address(0), "BalanceVerifier not set");
        zkpEnabled = _enabled;
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
        require(msg.sender != to, "Cannot transfer to yourself");
        
        // PKI Verification (if enabled)
        if (pkiEnabled && address(pkiRegistry) != address(0)) {
            require(pkiRegistry.isKYCValid(msg.sender), "KYC not valid");
            require(pkiRegistry.canUserTransfer(msg.sender, amount), "Transfer not authorized or exceeds daily limit");
        }
        
        // Cập nhật số dư
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Sinh transactionId mới & phát events (lưu history qua event, không lưu struct)
        transactionCounter++;
        uint256 txId = transactionCounter;

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
        emit BalanceUpdated(msg.sender, balances[msg.sender]);
        emit BalanceUpdated(to, balances[to]);
        
        // Record transfer in PKI (if enabled)
        if (pkiEnabled && address(pkiRegistry) != address(0)) {
            pkiRegistry.recordTransfer(msg.sender, amount);
        }
        
        return txId;
    }
    
    /**
     * @dev Chuyển tiền với PQC signature (lưu signature on-chain)
     * @param to Địa chỉ người nhận
     * @param amount Số tiền (trong wei)
     * @param toBankCode Mã ngân hàng nhận
     * @param description Mô tả giao dịch
     * @param pqcSignature PQC signature (Base64 encoded bytes)
     * @param algorithm PQC algorithm name (e.g., "Dilithium3")
     * @return transactionId ID của giao dịch
     */
    function transferWithPQC(
        address to,
        uint256 amount,
        string memory toBankCode,
        string memory description,
        bytes memory pqcSignature,
        string memory algorithm
    ) public returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(
            balances[msg.sender] >= amount,
            "Insufficient balance"
        );
        require(msg.sender != to, "Cannot transfer to yourself");
        require(pqcSignature.length > 0, "PQC signature cannot be empty");
        require(bytes(algorithm).length > 0, "Algorithm cannot be empty");
        
        // PKI Verification (if enabled)
        if (pkiEnabled && address(pkiRegistry) != address(0)) {
            require(pkiRegistry.isKYCValid(msg.sender), "KYC not valid");
            require(pkiRegistry.canUserTransfer(msg.sender, amount), "Transfer not authorized or exceeds daily limit");
        }
        
        // Lưu PQC signature on-chain qua PQCSignatureRegistry (nếu đã cấu hình)
        // (Nếu chưa cấu hình pqcRegistry thì vẫn cho phép chuyển tiền nhưng không lưu chữ ký)
        
        // Cập nhật số dư
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Sinh transactionId mới & phát events
        transactionCounter++;
        uint256 txId = transactionCounter;

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
        emit BalanceUpdated(msg.sender, balances[msg.sender]);
        emit BalanceUpdated(to, balances[to]);
        
        // Lưu PQC signature on-chain sau khi transfer thành công
        if (address(pqcRegistry) != address(0)) {
            pqcRegistry.storePQCSignature(txId, pqcSignature, algorithm);
        }
        
        // Record transfer in PKI (if enabled)
        if (pkiEnabled && address(pkiRegistry) != address(0)) {
            pkiRegistry.recordTransfer(msg.sender, amount);
        }
        
        return txId;
    }
    
    /**
     * @dev Chuyển tiền với ZKP proof (balance > amount)
     * @param to Địa chỉ người nhận
     * @param amount Số tiền (trong wei)
     * @param toBankCode Mã ngân hàng nhận
     * @param description Mô tả giao dịch
     * @param proofAmount Số tiền trong proof
     * @param commitmentHash Hash của balance commitment
     * @param proofBytes Proof bytes từ ZKP prover
     * @return transactionId ID của giao dịch
     */
    function transferWithZKP(
        address to,
        uint256 amount,
        string memory toBankCode,
        string memory description,
        uint256 proofAmount,
        bytes32 commitmentHash,
        bytes memory proofBytes
    ) public returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(msg.sender != to, "Cannot transfer to yourself");
        require(zkpEnabled && address(balanceVerifier) != address(0), "ZKP not enabled");
        require(proofAmount == amount, "Proof amount mismatch");
        
        // Tạo BalanceProof struct
        IBalanceVerifier.BalanceProof memory proof = IBalanceVerifier.BalanceProof({
            amount: proofAmount,
            commitmentHash: commitmentHash,
            proofBytes: proofBytes,
            userAddress: msg.sender
        });
        
        // Verify ZKP proof
        bool verified = balanceVerifier.verifyProof(proof);
        require(verified, "ZKP proof verification failed");
        
        // Verify balance từ contract (double check)
        // Note: Trong production, balance sẽ được verify từ commitment
        // nhưng để đảm bảo tính nhất quán, chúng ta vẫn check balance thực tế
        require(
            balances[msg.sender] >= amount,
            "Insufficient balance"
        );
        
        // PKI Verification (if enabled)
        if (pkiEnabled && address(pkiRegistry) != address(0)) {
            require(pkiRegistry.isKYCValid(msg.sender), "KYC not valid");
            require(pkiRegistry.canUserTransfer(msg.sender, amount), "Transfer not authorized or exceeds daily limit");
        }
        
        // Cập nhật số dư
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Sinh transactionId mới & phát events
        transactionCounter++;
        uint256 txId = transactionCounter;

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
        emit BalanceUpdated(msg.sender, balances[msg.sender]);
        emit BalanceUpdated(to, balances[to]);
        
        // Record transfer in PKI (if enabled)
        if (pkiEnabled && address(pkiRegistry) != address(0)) {
            pkiRegistry.recordTransfer(msg.sender, amount);
        }
        
        return txId;
    }
    
    /**
     * @dev Get user's PQC public key from PKI
     */
    function getUserPublicKey(address user) external view returns (bytes memory) {
        require(pkiEnabled && address(pkiRegistry) != address(0), "PKI not enabled");
        return pkiRegistry.getUserPublicKey(user);
    }
    
    /**
     * @dev Check if user can transfer amount
     */
    function checkTransferAuthorization(address user, uint256 amount) external view returns (bool) {
        if (!pkiEnabled || address(pkiRegistry) == address(0)) {
            return true; // PKI not enforced
        }
        return pkiRegistry.isKYCValid(user) && pkiRegistry.canUserTransfer(user, amount);
    }
    
    /**
     * @dev Rút tiền từ contract (withdraw)
     * @param amount Số tiền cần rút (trong wei)
     * @param description Mô tả giao dịch rút tiền
     * @return transactionId ID của giao dịch
     */
    function withdraw(uint256 amount, string memory description) public returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // PKI Verification (if enabled) - rút tiền cũng cần KYC
        if (pkiEnabled && address(pkiRegistry) != address(0)) {
            require(pkiRegistry.isKYCValid(msg.sender), "KYC not valid");
            // Withdraw không cần check daily limit vì đây là rút tiền, không phải transfer
        }
        
        // Trừ số dư từ contract
        balances[msg.sender] -= amount;
        emit BalanceUpdated(msg.sender, balances[msg.sender]);

        // Sinh transactionId mới & phát events (chỉ để tracking, không gửi native ETH)
        transactionCounter++;
        uint256 txId = transactionCounter;

        emit Transfer(
            txId,
            msg.sender,
            address(0),
            amount,
            bankCodes[msg.sender],
            "WITHDRAWAL",
            description,
            block.timestamp
        );
        return txId;
    }
}

