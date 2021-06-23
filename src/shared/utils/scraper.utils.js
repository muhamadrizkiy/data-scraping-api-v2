import * as puppeteer from "puppeteer";
import * as fetch from "node-fetch";
import * as https from "https";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

async function logout(page) {
  try {
    await page.evaluate(() => {
      var iframe = parent.document.querySelector("frame");
      iframe.contentDocument.querySelector('a[id="btnCancelReg"]').click();
    });
    await page.waitForTimeout(1000);
  } catch {
    throw "Error on Logout";
  }
}

const formatDate = (date) => {
  const year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  if (month.length < 2) {
    month = "0" + month;
  }
  if (day.length < 2) {
    day = "0" + day;
  }
  return day + "/" + month + "/" + year;
};

export const scraper = async (USER, PWD) => {
  var results = {
    result: {},
    errors: [],
  };
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "font"].indexOf(req.resourceType()) !== -1) {
      req.abort();
    } else {
      req.continue();
    }
  });
  // Navigate to internet banking
  try {
    await page.goto("https://ibank.bankmandiri.co.id/retail3/", {
      waitUntil: "networkidle0",
    });
  } catch {
    results.errors.push("Website is down");
    await browser.close();
    return results;
  }

  var frameHandler = await page.$('frame[name="mainFrame"]');
  var frame = await frameHandler.contentFrame();
  // Login process
  try {
    await frame.waitForSelector('input[id="userid_sebenarnya"]');
    await frame.type('input[id="userid_sebenarnya"]', USER);
    await frame.type('input[id="pwd_sebenarnya"]', PWD);
    await frame.waitForSelector('button[id="btnSubmit"]');
    await page.evaluate(() => {
      const frame = document.querySelector('frame[name="mainFrame"]');
      frame.contentDocument.querySelector('button[id="btnSubmit"]').click();
    });
    await frame.waitForSelector("p.nominal");
    const isLoginError = await page.$("div#errorMessage");
    if (isLoginError) {
      throw "loginError";
    }
  } catch (err) {
    results.errors.push("Incorrect username or password");
    await browser.close();
    return results;
  }

  // For backup API calls, get cookies
  const cookies = await page.cookies();
  const sessionId = cookies.find((item) => {
    return item.name === "JSESSIONIDRET3";
  }).value;
  const ibankBankMandiri = cookies.find((item) => {
    return item.name === "ibankbankmandiri";
  }).value;
  await frame.waitForSelector("a[id^=currentId]");
  const accountNumbers = await page.evaluate(() => {
    let accountNumbers = [];
    const iframe = parent.document.querySelector('frame[name="mainFrame"]');
    const accountContainer = iframe.contentDocument.querySelectorAll(
      ".acc-group"
    )[0];
    const accountList = accountContainer.querySelectorAll(".acc-item");
    accountList.forEach((item) => {
      const accountNumber = item
        .querySelector("a[id^=currentId]")
        .getAttribute("data-accountno");
      const name = item
        .querySelector("a[id^=currentId]")
        .getAttribute("data-accountname");
      accountNumbers.push({
        number: accountNumber.trim(),
        name: name.trim(),
      });
    });
    return accountNumbers;
  });

  const isAPIAvailable = Boolean(
    sessionId && ibankBankMandiri && accountNumbers.length >= 1
  );

  // Fetching balance
  try {
    if (!isAPIAvailable) {
      throw "One or more session variable(s) is not available";
    }
    let accounts = [];

    for (var i = 0; i < accountNumbers.length; i++) {
      let accNum = accountNumbers[i].number;
      let name = accountNumbers[i].name;
      const balanceRes = await fetch(
        "https://ibank.bankmandiri.co.id/retail3/secure/pcash/retail/account/portfolio/getBalance/" +
          accNum,
        {
          method: "GET",
          headers: {
            Cookie:
              "JSESSIONIDRET3=" +
              sessionId +
              "; ibankbankmandiri=" +
              ibankBankMandiri +
              ";",
            Accept: "application/json",
          },
          agent: httpsAgent,
        }
      );
      if (balanceRes.status === 200) {
        const balanceJson = await balanceRes.json();
        accounts.push({
          accountNumber: accNum,
          name: name,
          currency: balanceJson.currencyCode.trim(),
          balance: balanceJson.accountBalance.trim(),
        });
      } else {
        throw "Could not connect to balance API";
      }
    }

    results.result.accounts = accounts;
  } catch {
    try {
      const tempAccounts = await page.evaluate(() => {
        let accounts = [];
        var iframe = parent.document.querySelector('frame[name="mainFrame"]');
        var accountContainer = iframe.contentDocument.querySelectorAll(
          ".acc-group"
        )[0];
        var accountList = accountContainer.querySelectorAll(".acc-item");
        accountList.forEach((account) => {
          const accountNumber = account
            .querySelector("a[id^=currentId]")
            .getAttribute("data-accountno");
          const name = account
            .querySelector("a[id^=currentId]")
            .getAttribute("data-accountname");
          const currencyElement = account.querySelector(
            "p.nominal span.no-currency"
          );
          const currency = currencyElement.innerText;
          const decimalElement = account.querySelector("p.nominal sup.decimal");
          let balance = account.querySelector("p.nominal");
          while (balance.children.length > 0) {
            balance.removeChild(balance.children[0]);
          }
          accounts.push({
            accountNumber: accountNumber.trim(),
            name: name.trim(),
            currency: currency,
            balance: balance.innerText.trim(),
          });
        });
        return accounts;
      });
      results.result.accounts = tempAccounts;
    } catch (err) {
      results.errors.push("Could not fetch account balance");
    }
  }

  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (var i = 0; i < results.result.accounts.length; i++) {
      let accountNumberActive = results.result.accounts[i].accountNumber;
      let transactionUIAvailable = true;

      // Navigate to transaction history
      try {
        await page.evaluate((accNum) => {
          var iframe = parent.document.querySelector('frame[name="mainFrame"]');
          const accTransactionButton = iframe.contentDocument.querySelector(
            'a[data-accountno="' + accNum + '"]'
          );
          accTransactionButton.click();
        }, accountNumberActive);
      } catch (err) {
        transactionUIAvailable = false;
      }

      // Get transaction from API, if catched get try to get from UI
      let transactions = [];
      for (var j = 0; j < 6; j++) {
        //Change dates to search previous months
        let firstDay = new Date(now.getFullYear(), now.getMonth() - j, 1);
        let lastDay = new Date(now.getFullYear(), now.getMonth() - j + 1, 0);
        let yearActive = firstDay.getFullYear();
        if (j === 0) {
          lastDay = now;
        }
        try {
          if (!isAPIAvailable) {
            throw "Err";
          }
          const transactionRes = await fetch(
            "https://ibank.bankmandiri.co.id/retail3/secure/pcash/retail/account/portfolio/searchTransaction?accountNo=" +
              accountNumberActive.trim() +
              "&searchCasaBy=PERIOD&fromDate=" +
              firstDay.getTime() +
              "&toDate=" +
              lastDay.getTime() +
              "&transactionTypeCode=S",
            {
              method: "GET",
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
                Cookie:
                  "JSESSIONIDRET3=" +
                  sessionId +
                  "; ibankbankmandiri=" +
                  ibankBankMandiri +
                  ";",
              },
              agent: httpsAgent,
            }
          );
          if (transactionRes.status === 200) {
            const transactionJson = await transactionRes.json();
            const tableData = transactionJson.aaData || [];
            tableData.forEach((item) => {
              transactions.push({
                date: item.postingDate + "/" + yearActive || "",
                description: item.transactionRemark || "",
                amountRight: item.debitCreditFlag !== "K" ? item.amount : "-",
                amountLeft: item.debitCreditFlag === "K" ? item.amount : "-",
              });
            });
          }
        } catch (err) {
          if (transactionUIAvailable) {
            if (j !== 0) {
              let firstDayString = formatDate(firstDay);
              let lastDayString = formatDate(lastDay);
              await page.evaluate(
                (first, last) => {
                  var iframe = parent.document.querySelector("frame");
                  iframe.contentDocument.querySelector(
                    "#fromDate"
                  ).value = first;
                  iframe.contentDocument.querySelector("#toDate").value = last;
                  iframe.contentDocument.querySelector("#btnSearch").click();
                },
                firstDayString,
                lastDayString
              );
            }

            await frame.waitForSelector("table[id=globalTable]");
            await page.waitForFunction(
              () => {
                const iframe = parent.document.querySelector(
                  'frame[name="mainFrame"]'
                );
                if (iframe.contentDocument.querySelector(".dataTables_empty")) {
                  return !iframe.contentDocument
                    .querySelector(".dataTables_empty")
                    .innerText.includes("Loading");
                } else {
                  return true;
                }
              },
              { polling: "raf" }
            );

            let tempTransactions = await page.evaluate(() => {
              var result = [];
              var iframe = parent.document.querySelector("frame");
              if (
                iframe.contentDocument.querySelectorAll(".dataTables_empty")
                  .length === 1
              ) {
                return result;
              }
              var trs = iframe.contentDocument.querySelectorAll(
                "#globalTable tbody tr"
              );

              trs.forEach((tr) => {
                var trx = {
                  date:
                    tr.querySelector("td.trxdate").innerText + "/" + yearActive,
                  description: tr.querySelector("td.desc").innerText,
                  amountRight: tr.querySelectorAll("td.right.amount.upper")[0]
                    .innerText,
                  amountLeft: tr.querySelectorAll("td.right.amount.upper")[1]
                    .innerText,
                };
                result.push(trx);
              });

              return result;
            });
            transactions = transactions.concat(tempTransactions);
          }
        }
      }
      results.result.accounts[i].transactions = transactions;
    }
  } catch (err) {
    results.errors.push("Could not retrieve transactions");
  }

  await logout(page).catch((err) => {
    results.errors.push(err);
  });
  await browser.close();
  return results;
};
