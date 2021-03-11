// const fs = require('fs');
const fsPrommises = require('fs').promises;
const { google } = require('googleapis');
var base64 = require('js-base64').Base64;
const cheerio = require('cheerio');
var Mailparser = require('mailparser').MailParser;

const _useMockRefunds = false;

// main();

function main() {
    const pCredentials = fsPrommises.readFile('../common/credentials.json');
    const pUser = fsPrommises.readFile('user-mock.json');
    Promise.all([pCredentials, pUser])
        .then(results => {
            let credentials = JSON.parse(results[0]);
            let user = JSON.parse(results[1]);
            //Authorize a client with credentials, then call the Gmail API.
            let oAuth2Client = createClient(credentials, user.accessToken, user.refreshToken);
            oAuth2Client.on('tokens', (tokens) => {
                //TODO: save tocken in database
                console.log(tokens);
                if (tokens.refresh_token) {
                    console.log(`REFRESH TOKEN: ${tokens.refresh_token}`);
                }
                console.log(`ACCESS TOKEN: ${tokens.access_token}`);
            });
            analyzeRefunds(oAuth2Client);
        })
        .catch(error => {
            console.log('Error loading files: ', error);
        })
    return;
}

function createClient(credentials, accessToken, refreshToken) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    oAuth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return oAuth2Client;
}

async function analyzeRefunds(auth) {
    const refunds = await getRefundEmails(auth);
    console.log(JSON.stringify(refunds));
}

async function getRefundEmails(auth) {

    //check mock
    if (_useMockRefunds) {
        try {
            let mockRefunds = await fsPrommises.readFile('refunds-mock.json');
            if (mockRefunds) {
                return JSON.parse(mockRefunds);
            }
        }
        catch (e) { }
    }

    const gmail = google.gmail({ version: 'v1', auth });
    const query = "return@amazon.com";

    let refundList = [];

    const res = await gmail.users.messages.list({
        userId: 'me',
        q: query
    });

    const messagesIds = res.data.messages.map(msg => msg.id);
    for (let index = 0; index < messagesIds.length; index++) {
        const messageId = messagesIds[index];
        const bodyRes = await gmail.users.messages.get({
            'userId': 'me',
            'id': messageId
        });

        /*
        [{   name: "MIME-Version",
            value: "1.0",
        },{    name: "Date",
            value: "Wed, 17 Mar 2021 16:20:41 -0700",
        },{   name: "References",
            value: "<01000177885abb68-b47560ca-46f7-4664-be8b-341dabd53f89-000000@email.amazonses.com>",
        },{   name: "In-Reply-To",
            value: "<01000177885abb68-b47560ca-46f7-4664-be8b-341dabd53f89-000000@email.amazonses.com>",
        },{   name: "Message-ID",
            value: "<CAFG6J_Pnivk=1tTSdOL4Y1dn6sSWo17Bk5Y7OWnFVny2=WKULw@mail.gmail.com>",
        },{   name: "Subject",
            value: "Fwd: Your refund for IXS Unisex Flow Evo+ Breathable....",
        },{   name: "From",
            value: "Ben Nagar <super.nagar@gmail.com>",
        },{   name: "To",
            value: "Ben Nagar <ben@fred.house>",
        },{ name: "Content-Type",
            value: "multipart/alternative; boundary=\"0000000000003f6a3c05bdc3bb5f\"",
        },]
        */
        let headersFromRes = bodyRes.data.payload.headers;
        let headers = {};
        headersFromRes.forEach((header) => {
            switch (header.name) {
                case 'Subject':
                    headers.subject = header.value;
                    break;
                case 'Date':
                    headers.date = new Date(header.value);
                    break;
            }
        });

        const body = bodyRes.data.payload.parts[0].body.data;
        const refund = Refund.newRefundFromEmail(headers, body);
        refundList.push(refund);
    }

    if (_useMockRefunds) {
        try {
            const data = JSON.stringify(refundList);
            fsPrommises.writeFile('refunds-mock.json', data, (err) => {
                if (err) {
                    throw err;
                }
                console.log('mock refunds file saved.');
            });
        }
        catch (e) {
            console.error('Can not save mock refunds: ', e);
        }
    }

    return refundList;
}

// Regex tool https://regex101.com
class Refund {
    date;
    subject;
    amount;
    productName;
    status; // started | completed | verified
    merchant;
    link;
    error;
    constructor() { }

    static newRefundFromEmail(headers, body) {
        var refund = new Refund();
        refund.date = headers.date;
        refund.subject = headers.subject;
        const textBody = base64.decode(body.replace(/-/g, '+').replace(/_/g, '/'));
        const name = Refund.getProductName(textBody);
        const link = Refund.getLink(textBody);
        refund.productName = name;
        refund.link = link;
        refund.merchant = "Amazon";

        var amount = Refund.getRefundAmount(textBody);
        if (amount.number) {
            refund.amount = amount;
            refund.satus = 'completed';
        } else {
            amount = Refund.getEstimatedAmount(textBody);
            if (amount.number) {
                refund.amount = amount;
                refund.status = 'started';
            } else {
                refund.error = Error("didn't find amount in email body");
            }
        }
        return refund;
    }

    static getRefundAmount(text) {
        var regex = /[R|r]efund total:.+([$]([0-9]+.?[0-9]{2}))/gm;
        let m = regex.exec(text);
        return { text: m?.[1], number: m?.[2] };
    }

    static getEstimatedAmount(text) {
        var regex = /[E|e]stimated refund:.+([$]([0-9]+.?[0-9]{2}))/gm;
        let m = regex.exec(text);
        return { text: m?.[1], number: m?.[2] };
    }

    static getProductName(text) {
        var regex = /Item details:\W+(...*)/gm;
        let m = regex.exec(text);
        return m?.[1];
    }

    static getLink(text) {
        var regex = /Check return & refund status:\W+(...*)/gm;
        let m = regex.exec(text);
        return m?.[1];
    }
}