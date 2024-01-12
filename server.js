const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca(); // Gets defined through env variables
const WebSocket = require('ws');


// Server < -- > Data Source
// WebSockets are like push notifications, are listeners that send notifications

const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");

wss.on("open", function() {
    console.log("WebSocket has connected");

    // Log in to data source
    const authMsg = {
        action: 'auth',
        key: process.env.APCA_API_KEY_ID,
        secret: process.env.APCA_API_SECRET_KEY
    };

    wss.send(JSON.stringify(authMsg)); // Sending auth details to web socket

    // Subscribe to All News feeds
    const subscribeMsg = {
        action: 'subscribe',
        news: ['*'], // * means to all, if only Apple, then do ['AAPL']
    };

    wss.send(JSON.stringify(subscribeMsg)); // Sends message to subscribe to all news
});

wss.on('message', async function (message) {
    console.log("Message is " + message);
    // Message is sent as a string
    const currentEvent = JSON.parse(message)[0];
    // Only check if message is a news event, where "T": "n"
    if (currentEvent.T === 'n') {

        let companyImpact = 0;
        // Ask ChatGPT its thoughts on the headline
        const apiRequestBody = {
            "model": 'gpt-3.5-turbo',
            "messages": [
                // How ChatGPT should respond to my prompt
                { role: "system", content: "I want you to act as a stock analyst and only respond with a number between 0-100 detailing the impact of the headline"},
                // The headline being passed
                {role: "user", content: "The headline is '" + currentEvent.headline + "\', remember to only give a number between 0 and 100 detaling the impact (100 being the most positive)"}
            ]
        }

        await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(apiRequestBody)
        }).then((data) => {
            return data.json();
        }).then((data) => {
            // The data is the parsed gpt response
            console.log(data);
            console.log(data.choices[0].message);
            companyImpact = parseInt(data.choices[0].message.content);
        });

        console.log("The headline parsed was", currentEvent.headline);

        // Make trades based on the output
        const tickerSymbol = currentEvent.symbols[0]


        if (companyImpact > 70) {
            // Buy Stock
            let order = await alpaca.createOrder({
                symbol: tickerSymbol,
                qty: 1,
                side: 'buy',
                type: "market",
                time_in_force: 'day' // if day ends, it won't trade
            });
            console.log("Finished buy order for " + tickerSymbol);
        } else if (companyImpact < 30) {
            // Sell Stock
            let closedPosition = alpaca.closedPosition(tickerSymbol)
            console.log("Finished sell order for " + tickerSymbol);
        }


    }
});


