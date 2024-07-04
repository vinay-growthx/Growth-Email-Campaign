const OpenAI = require("openai");
const { Sentry } = require("../services/sentry");

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_1,
});

const openai2 = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_2,
});

const openai3 = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_3,
});

const openai4 = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_4,
});

const openai5 = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_5,
});

const openai6 = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_6,
});

const openai7 = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_7,
});

const openai8 = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY_8,
}); //Enigma GPT4

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

const azureopenai = new OpenAIClient(
  "https://easysource2.openai.azure.com/",
  new AzureKeyCredential("d609434c01c34a8cb323628127cd5d8d")
);
async function chatGPTPromptResult(options) {
  let {
    messages,
    temperature = 0.5,
    top_p = 1.0,
    frequency_penalty = 0.0,
    presence_penalty = 0.0,
    stop = null,
    maxRetries = 6,
    model = "gpt-4-1106-preview",
  } = options;
  let retryAttempts = 0;
  let grpResponse = { status: 200 };
  while (retryAttempts < maxRetries) {
    try {
      if (model == "gpt-4-1106-preview" && retryAttempts == 0) {
        console.log("Using GPT-4 model 1 Azure");
        grpResponse.data = await azureopenai.getChatCompletions(
          "GPT-4-1106",
          messages,
          {
            temperature: temperature,
            top_p: top_p,
            frequency_penalty: frequency_penalty,
            presence_penalty: presence_penalty,
            stop: stop,
          }
        );
      } else if (model == "gpt-4-1106-preview" && retryAttempts == 1) {
        console.log("Using GPT-4 model 2 Subham");
        grpResponse.data = await openai5.chat.completions.create({
          model: model,
          messages: messages,
          temperature: temperature,
          top_p: top_p,
          frequency_penalty: frequency_penalty,
          presence_penalty: presence_penalty,
          stop: stop,
        });
      } else if (model == "gpt-4-1106-preview" && retryAttempts == 2) {
        console.log("Using GPT-4 model 3 Vishal");
        grpResponse.data = await openai7.chat.completions.create({
          model: model,
          messages: messages,
          temperature: temperature,
          top_p: top_p,
          frequency_penalty: frequency_penalty,
          presence_penalty: presence_penalty,
          stop: stop,
        });
      } else {
        if (retryAttempts % 3 == 0) {
          console.log("Using GPT-3.5 4K Azure model 1");
          grpResponse.data = await azureopenai.getChatCompletions(
            "GPT-35-4K-LATEST",
            messages,
            {
              temperature: temperature,
              top_p: top_p,
              frequency_penalty: frequency_penalty,
              presence_penalty: presence_penalty,
              stop: stop,
            }
          );
        } else if (retryAttempts % 3 == 1) {
          console.log("Using GPT-3.5 4K Openai Subham model 2");
          grpResponse.data = await openai5.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: temperature,
            top_p: top_p,
            frequency_penalty: frequency_penalty,
            presence_penalty: presence_penalty,
            stop: stop,
          });
        } else {
          console.log("Using GPT-3.5 16K Azure model 3");
          grpResponse.data = await azureopenai.getChatCompletions(
            "GPT-35-16K-LATEST",
            messages,
            {
              temperature: temperature,
              top_p: top_p,
              frequency_penalty: frequency_penalty,
              presence_penalty: presence_penalty,
              stop: stop,
            }
          );
        }
      }
      if (grpResponse.status == 200) {
        // console.log(grpResponse.data.choices[0].message.content);
        return grpResponse.data.choices[0].message.content;
      } else {
        console.log("Error in ChatGPT", grpResponse.data);
        // throw new Error("Please Try Again");
        return "";
      }
    } catch (err) {
      console.log(
        `Request response code ${
          err?.response?.status || err?.code
        } for ChatGPT. Retrying time ${retryAttempts + 1} after delay...`
      );
      console.log(
        `Error description: ${JSON.stringify(
          err?.response?.data || err?.message
        )}`
      );
      Sentry.captureException(err);
      retryAttempts++;
      await delay(1000);
    }
  }
  return "";
}
async function generateCustomLine(completeText, customValue) {
  let retryAttempts = 0;
  const maxRetryAttempts = 3;
  const delayTime = 1000;
  let prompt = `${completeText}\n\n`;
  prompt += `Using receiver's info mentioned above, complete the instruction provided within the curly brackets below. This curly bracket text is part of an email.\n
    ${customValue}\n
    Do NOT add any placeholders and adhere strictly to the text and instructions inside the curly bracket.\n
    Strictly follow output format given below.\n
  
    Output: modified line\n`;
  console.log("prompt gone to gpt ==>", prompt);
  const content = await chatGPTPromptResult({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 300,
    top_p: 1,
  });
  console.log("gpt Custom line", content);
  const filtersText = content.replace("Output:", "").trim();
  const filters = filtersText.split("\n").map((filter) => filter.trim());
  return {
    content: filters.join("\n"),
  };
}

async function generateProfessionalSubject(originalSubject) {
  const maxRetries = 3;
  const retryDelay = 1000;

  const prompt = `
      Original email subject: "${originalSubject}"
      Please convert the above email subject into a more professional version. Follow these guidelines:
      1. Remove any brackets or parentheses.
      2. Improve the wording to sound more formal and business-like.
      3. Ensure the subject is clear, concise, and engaging.
      4. Maintain the core message of the original subject.
      Provide only the revised subject line without any additional text or explanations.
    `;

  console.log("Prompt sent to GPT:", prompt);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await chatGPTPromptResult({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 50,
        top_p: 1,
      });

      console.log("GPT response:", response);

      const professionalSubject = response.trim();

      return { subject: professionalSubject };
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        throw new Error(
          "Failed to generate professional subject after multiple attempts"
        );
      }
    }
  }
}

module.exports = { generateCustomLine, generateProfessionalSubject };
