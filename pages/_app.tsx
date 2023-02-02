import type { AppProps } from "next/app";
import { 
  ChainId, 
  WalletConnectConnectorType,
  InjectedConnectorType,
  ThirdwebProvider } from "@thirdweb-dev/react";
import { MagicConnector } from "@thirdweb-dev/react/evm/connectors/magic";
import "../styles/globals.css";
import Head from "next/head";

// This is the chainId your dApp will work on.
const activeChainId = ChainId.Mumbai;
console.log("activeChainId ", activeChainId);

// This is the meta-transaction relayer that provides gasless transactions
const relayerUrlProp = process.env.NEXT_PUBLIC_GASLESS_OPENZEPPELIN_RELAYER_URL as string;
console.log("relayerUrlProp ", relayerUrlProp);


// Set up wallet connectors you want to use for your dApp.
const magicLinkConnector = new MagicConnector({
  options: {
    apiKey: process.env.NEXT_PUBLIC_MAGIC_LINK_API_KEY as string,
    rpcUrls: {
      [activeChainId]: process.env.NEXT_PUBLIC_CHAIN_RPC as string,
    }
  }
});
const metamaskConnector: InjectedConnectorType = {
  name: "metamask",
  options: {
    shimDisconnect: true
  }
};
const walletConnector: WalletConnectConnectorType = {
  name: "walletConnect",
  options: { 
    chainId: activeChainId.valueOf()
  }
};
const  connectors = [
  metamaskConnector,
  walletConnector,
  magicLinkConnector
];

// Main app function
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThirdwebProvider 
      sdkOptions={{
        gasless: {
          openzeppelin: {
            relayerUrl: relayerUrlProp,
          },
        },
      }} 
      chainRpc={{
        [activeChainId]: process.env.NEXT_PUBLIC_CHAIN_RPC as string,
      }}
      walletConnectors={connectors}
      desiredChainId={activeChainId}
    >
    <Head>
        <title>thirdweb Edition Drop Minting Customizable Page</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="Learn How To Use Thirdweb's Edition Drop contract and create a customizable Edition Drop minting page"
        />
        <meta
          name="keywords"
          content="Thirdweb, thirdweb Edition drop, how to make thirdweb nft drop, how to make nft collection thirdweb"
        />
      </Head>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}

export default MyApp;
