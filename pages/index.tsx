import {
  useActiveClaimConditionForWallet,
  useAddress,
  useDisconnect,
  useClaimConditions,
  useClaimerProofs,
  useClaimIneligibilityReasons,
  useContract,
  useContractMetadata,
  useNFT,
  useTotalCirculatingSupply,
  Web3Button,
  useWalletConnect,
  useMetamask } from "@thirdweb-dev/react";
import { useMagic } from "@thirdweb-dev/react/evm/connectors/magic";
import { BigNumber, utils } from "ethers";
import type { NextPage } from "next";
import { useMemo, useState } from "react";
import styles from "../styles/Theme.module.css";
import { parseIneligibility } from "../utils/parseIneligibility";

// Put Your Edition Drop Contract address from the dashboard here
const myEditionDropContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_NFT_EDITION_DROP as string;
console.log("myEditionDropContractAddress ", myEditionDropContractAddress);

// Token ID to mint
const tokenId = 0;

const Home: NextPage = () => {
  const address = useAddress();
  const connectWithWalletConnect = useWalletConnect(); // Hook to connect with WalletConnect.
  const connectWithMetamask = useMetamask(); // Hook to connect with MetaMask.
  const connectWithMagic = useMagic(); // Hook to connect with Magic Link.
  const disconnectWallet = useDisconnect(); // Hook to disconnect from the connected wallet.
  const [email, setEmail] = useState<string>(""); // State to hold the email address the user entered.
  const [quantity, setQuantity] = useState(1); // Quantity of tokens to mint when Mint button is pressed
  const { contract: editionDrop } = useContract(myEditionDropContractAddress);
  const { data: contractMetadata } = useContractMetadata(editionDrop);
  const { data: nft, isLoading: loadingNFT } = useNFT(editionDrop, tokenId);

  const claimConditions = useClaimConditions(editionDrop);
  const activeClaimCondition = useActiveClaimConditionForWallet(
    editionDrop,
    address,
    tokenId
  );
  const claimerProofs = useClaimerProofs(editionDrop, address || "", tokenId);
  const claimIneligibilityReasons = useClaimIneligibilityReasons(
    editionDrop,
    {
      quantity,
      walletAddress: address || "",
    },
    tokenId
  );

  const claimedSupply = useTotalCirculatingSupply(editionDrop, tokenId);

  const totalAvailableSupply = useMemo(() => {
    try {
      return BigNumber.from(activeClaimCondition.data?.availableSupply || 0);
    } catch {
      return BigNumber.from(1_000_000);
    }
  }, [activeClaimCondition.data?.availableSupply]);

  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply.data || 0).toString();
  }, [claimedSupply]);

  const numberTotal = useMemo(() => {
    const n = totalAvailableSupply.add(BigNumber.from(claimedSupply.data || 0));
    if (n.gte(1_000_000)) {
      return "";
    }
    return n.toString();
  }, [totalAvailableSupply, claimedSupply]);

  const priceToMint = useMemo(() => {
    const bnPrice = BigNumber.from(
      activeClaimCondition.data?.currencyMetadata.value || 0
    );
    return `${utils.formatUnits(
      bnPrice.mul(quantity).toString(),
      activeClaimCondition.data?.currencyMetadata.decimals || 18
    )} ${activeClaimCondition.data?.currencyMetadata.symbol}`;
  }, [
    activeClaimCondition.data?.currencyMetadata.decimals,
    activeClaimCondition.data?.currencyMetadata.symbol,
    activeClaimCondition.data?.currencyMetadata.value,
    quantity,
  ]);

  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimableSupply || 0
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(1_000_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimablePerWallet || 0
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(1_000_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs.data?.maxClaimable;

    if (snapshotClaimable) {
      if (snapshotClaimable === "0") {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(1_000_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);
        } catch (e) {
          // fall back to default case
        }
      }
    }

    let max;
    if (totalAvailableSupply.lt(bnMaxClaimable)) {
      max = totalAvailableSupply;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(1_000_000)) {
      return 1_000_000;
    }
    return max.toNumber();
  }, [
    claimerProofs.data?.maxClaimable,
    totalAvailableSupply,
    activeClaimCondition.data?.maxClaimableSupply,
    activeClaimCondition.data?.maxClaimablePerWallet,
  ]);

  const isSoldOut = useMemo(() => {
    try {
      return (
        (activeClaimCondition.isSuccess &&
          BigNumber.from(activeClaimCondition.data?.availableSupply || 0).lte(
            0
          )) ||
        numberClaimed === numberTotal
      );
    } catch (e) {
      return false;
    }
  }, [
    activeClaimCondition.data?.availableSupply,
    activeClaimCondition.isSuccess,
    numberClaimed,
    numberTotal,
  ]);

  const canClaim = useMemo(() => {
    return (
      activeClaimCondition.isSuccess &&
      claimIneligibilityReasons.isSuccess &&
      claimIneligibilityReasons.data?.length === 0 &&
      !isSoldOut
    );
  }, [
    activeClaimCondition.isSuccess,
    claimIneligibilityReasons.data?.length,
    claimIneligibilityReasons.isSuccess,
    isSoldOut,
  ]);

  const isLoading = useMemo(() => {
    return (
      activeClaimCondition.isLoading || claimedSupply.isLoading || !editionDrop
    );
  }, [activeClaimCondition.isLoading, editionDrop, claimedSupply.isLoading]);

  const buttonLoading = useMemo(
    () => isLoading || claimIneligibilityReasons.isLoading,
    [claimIneligibilityReasons.isLoading, isLoading]
  );
  const buttonText = useMemo(() => {
    if (isSoldOut) {
      return "Sold Out";
    }

    if (canClaim) {
      const pricePerToken = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0
      );
      if (pricePerToken.eq(0)) {
        return "Mint (Free)";
      }
      return `Mint (${priceToMint})`;
    }
    if (claimIneligibilityReasons.data?.length) {
      return parseIneligibility(claimIneligibilityReasons.data, quantity);
    }
    if (buttonLoading) {
      return "Checking eligibility...";
    }

    return "Claiming not available";
  }, [
    isSoldOut,
    canClaim,
    claimIneligibilityReasons.data,
    buttonLoading,
    activeClaimCondition.data?.currencyMetadata.value,
    priceToMint,
    quantity,
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.mintInfoContainer}>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <>
              <div className={styles.infoSide}>
                {/* Image Preview of NFTs */}
                <img
                  className={styles.image}
                  src={contractMetadata?.image}
                  alt={`${contractMetadata?.name} preview image`}
                />
                {/* Title of your NFT Collection */}
                <h1>{contractMetadata?.name}</h1>
                {/* Description of your NFT Collection */}
                <p className={styles.description}>
                  {contractMetadata?.description}
                </p>
              </div>

              <div className={styles.imageSide}>
                {/* Image Preview of NFTs */}
              <img
                className={styles.image}
                src={nft?.metadata?.image!}
                alt={`${nft?.metadata?.name} preview image`}
              />

                {/* Amount claimed so far */}
                <div className={styles.mintCompletionArea}>
                  <div className={styles.mintAreaLeft}>
                    <p>Total Minted</p>
                  </div>
                  <div className={styles.mintAreaRight}>
                    {claimedSupply ? (
                      <p>
                        <b>{numberClaimed}</b>
                        {" / "}
                        {numberTotal || "∞"}
                      </p>
                    ) : (
                      // Show loading state if we're still loading the supply
                      <p>Loading...</p>
                    )}
                  </div>
                </div>

                {claimConditions.data?.length === 0 ||
                claimConditions.data?.every(
                  (cc) => cc.maxClaimableSupply === "0"
                ) ? (
                  <div>
                    <h2>
                      This drop is not ready to be minted yet. (No claim condition
                      set)
                    </h2>
                  </div>
                ) : (
                  <>
                    <div className={styles.mintContainer}>
                      {isSoldOut ? (
                        <div>
                          <h2>Sold Out</h2>
                        </div>
                      ) : (
                        <>
                          <>
                            {address ? (
                              <div className={styles.loginContainer}>
                                <Web3Button
                                  contractAddress={editionDrop?.getAddress() || ""}
                                  action={(cntr) => cntr.erc1155.claim(tokenId, quantity)}
                                  isDisabled={!canClaim || buttonLoading}
                                  onError={(err) => {
                                    console.error(err);
                                    alert("Error claiming NFTs");
                                  }}
                                  onSuccess={() => {
                                    setQuantity(1);
                                    alert("Successfully claimed NFTs");
                                  }}
                                >
                                  {buttonLoading ? "Loading..." : buttonText}
                                </Web3Button>

                                <h2 style={{ fontSize: "1.3rem" }}>You&apos;re Connected! 👋</h2>{" "}
                                <p>{address}</p>
                                <a className={styles.mainButton} onClick={() => disconnectWallet()}>
                                  Disconnect Wallet
                                </a>
                              </div>
                            ) : (
                              <>
                                <div
                                  style={{
                                    width: 600,
                                    maxWidth: "90vw",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexDirection: "row",
                                    gap: 16,
                                  }}
                                >
                                  <button 
                                    className={styles.mainButton} 
                                    onClick={connectWithWalletConnect}>
                                      Use WalletConnect
                                  </button>
                                </div>
                                <div
                                  style={{
                                    height: 15,
                                  }}
                                >
                                </div>
                                <div
                                  style={{
                                    width: 600,
                                    maxWidth: "90vw",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexDirection: "row",
                                    gap: 16,
                                  }}
                                >
                                  <button 
                                    className={styles.mainButton} 
                                    onClick={connectWithMetamask}>
                                      Use MetaMask
                                  </button>
                                </div>

                                <h2 style={{ fontSize: "1.3rem" }}>- Or -</h2>
                                <h1 style={{ fontSize: "1.1rem" }}>Use your email if you don&apos;t have a crypto wallet...</h1>
                                
                                <div
                                  style={{
                                    width: 500,
                                    maxWidth: "90vw",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexDirection: "row",
                                    gap: 16,
                                  }}
                                >
                                  <input
                                    type="email"
                                    placeholder="Log In With Email"
                                    className={styles.textInput}
                                    style={{ width: "90%", marginBottom: 0 }}
                                    onChange={(e) => setEmail(e.target.value)}
                                  />

                                  <a
                                    className={styles.mainButton}
                                    onClick={() => {
                                      connectWithMagic({ email });
                                    }}
                                  >
                                    Login
                                  </a>
                                </div>
                              </>
                            )}
                          </>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
