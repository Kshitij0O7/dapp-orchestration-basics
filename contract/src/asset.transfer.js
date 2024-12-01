import { E } from '@agoric/eventual-send';
import { AmountMath } from '@agoric/ertp';
import { makeTracer } from '@agoric/internal';

const trace = makeTracer('OrcaFlows');

export const makeAccount = async (seat, powers) => {
  const { orchestrationService } = powers;
  
  // Create an orchestration account
  const account = await E(orchestrationService).createAccount({
    chainName: 'agoric', // Specify the target chain
  });

  return account;
};

export const makeCreateAndFund = async (seat, powers) => {
  const { orchestrationService, localchain } = powers;
  
  // Get the amount to transfer from the seat
  const givePurse = seat.offerArgs.give;
  const [[brandKey, amount]] = Object.entries(givePurse);

  // Create an orchestration account
  const account = await E(orchestrationService).createAccount({
    chainName: 'agoric', // Specify the target chain
  });

  // Perform cross-chain transfer from Osmosis to Agoric
  const transferResult = await E(orchestrationService).transferAssets({
    source: {
      chainName: 'osmosis',
      address: await E(localchain).getAddress(), // Get local chain address
    },
    destination: {
      chainName: 'agoric',
      address: await E(account).getAddress(), // Get destination address
    },
    amount, // Amount to transfer
    brandKey, // Asset brand/denom
  });

  trace('Cross-chain transfer completed', transferResult);

  return account;
};

// Helper function to check transfer status if needed
export const checkTransferStatus = async (transferId, orchestrationService) => {
  const status = await E(orchestrationService).getTransferStatus(transferId);
  trace('Transfer status', status);
  return status;
};