const debitAmount = ["amountRight", "DB"];
const creditAmount = ["amountLeft", "CR"];
const description = ["description"];
const accountNumber = ["accountNumber"];

export const merge = (target, source) => {
  String.prototype.replace = function(index, replacement) {
    return (
      this.substr(0, index) +
      replacement +
      this.substr(index + replacement.length)
    );
  };
  // Iterate source properties
  for (const key of Object.keys(source)) {
    // check an `Object` set property to merge of `target` and `source` properties

    if (source[key] instanceof Object && key in target)
      Object.assign(source[key], merge(target[key], source[key]));

    // set desc as a description value from source
    if (description.includes(key)) source.desc = source[key];

    // remove any information in the Mandiri scraper that is not in the BCA scraper
    if (target[key] == undefined) delete source[key];

    // set if transaction is debit flow
    if (source[creditAmount[0]] === "-") {
      source.amount = source[debitAmount[0]];
      source.flow = debitAmount[1];
    }

    // set if transaction is cedit flow
    if (source[debitAmount[0]] === "-") {
      source.amount = source[creditAmount[0]];
      source.flow = creditAmount[1];
    }

    // hide account number
    if (accountNumber.includes(key))
      source[key] = source[key].replace(0, "*******");
  }

  // Join `target` and modified `source`
  Object.assign(target || {}, source);
  return target;
};
