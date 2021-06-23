import * as mongoose from 'mongoose';

export const CustomersSchema = new mongoose.Schema({
  accounts: Array,
  creditCards: Object
});
