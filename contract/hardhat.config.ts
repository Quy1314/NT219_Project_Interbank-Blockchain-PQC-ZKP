import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Private Key mặc định của Dev node Quorum (Lưu ý: Chỉ dùng cho dev)
const PRIVATE_KEY = "0x8f2a55943f386dc636428974d55f0a5eeac945e5e3174245f760e401183c5097"; 

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    besuLocal: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: [PRIVATE_KEY],
      gasPrice: 0,
    },
  },
};

export default config;