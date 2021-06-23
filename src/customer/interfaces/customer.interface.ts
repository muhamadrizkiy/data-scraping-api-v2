import { Document } from 'mongoose';

export interface Customer extends Document {
  readonly accounts: [
    {
      accountNumber: string;
      accountType: string;
      currency: string;
      balance: string;
      transactions: [
        {
          id: string;
          date: string;
          desc: string;
          cab: string;
          amount: string;
          flow: string;
          balance: string;
        }
      ];
    }
  ];
  readonly creditCards: object;
}
