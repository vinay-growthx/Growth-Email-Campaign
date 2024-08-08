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
  console.log("original subject ====>", originalSubject);
  const maxRetries = 3;
  const retryDelay = 1000;

  const prompt = `
  As an expert email copywriter, your task is to transform the following email subject line into a more professional, engaging, and effective version:

  Original subject: "${originalSubject}"

  Please rewrite the subject line following these guidelines:
  1. Enhance the professionalism and formality of the language.
  2. Ensure the subject is clear, concise, and compelling.
  3. Maintain the core message and intent of the original subject.
  4. Remove any unnecessary brackets, parentheses, or informal punctuation.
  5. Use action-oriented words to create a sense of urgency or importance.
  6. Optimize for email open rates by making it intriguing yet informative.
  7. Keep the length between 30 to 50 characters for optimal display on various devices.
  8. If applicable, personalize the subject line or make it more relevant to the recipient.
  9. Avoid using all caps, excessive punctuation, or spam trigger words.
  10. Consider the context of a professional business communication.

  Provide only the revised subject line without any additional text, explanations, or quotation marks. Ensure the response is a complete, well-formed subject line ready for use in a professional email.
`;

  console.log("Prompt sent to GPT:", prompt);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await chatGPTPromptResult({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
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
async function generateJobSummary(jobDetails) {
  const maxRetries = 3;
  const retryDelay = 1000;

  const prompt = `
  As a proficient summarizer, your task is to condense the following job posting details into a clear, concise, and informative summary of 2-3 lines:

  Job Details:
  "${jobDetails}"

  Please follow these guidelines for the summary:
  1. Include key details such as job title, company name, location, and type of employment.
  2. Summarize essential responsibilities and qualifications.
  3. Highlight any unique or notable aspects of the job or company.
  4. Maintain a professional tone suitable for a business context.
  5. Ensure the summary is well-organized and easy to read.
  6. Avoid unnecessary details and focus on what's most relevant to a potential applicant.
  7. Aim for a summary length of approximately 2-3 lines to keep it concise yet informative.
  `;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await chatGPTPromptResult({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
        top_p: 1,
      });

      console.log("GPT response:", response);

      const jobSummary = response.trim();

      return { summary: jobSummary };
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        throw new Error(
          "Failed to generate job summary after multiple attempts"
        );
      }
    }
  }
}
async function extractIndustryFromSummary(jobSummary) {
  const maxRetries = 3;
  const retryDelay = 1000;

  const prompt = `
  As a detail-oriented extractor, your task is to identify and specify the industry from the following job summary:

  Job Summary:
  "${jobSummary}"

  Please extract the industry if mentioned explicitly, or infer it based on the context and content of the summary. Provide the industry as a concise, single term or a brief phrase, such as "software development", "logistics", "healthcare", "education", etc.
  `;

  console.log("Prompt sent to GPT:", prompt);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await chatGPTPromptResult({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 50,
        top_p: 1,
      });

      // console.log("GPT response:", response);

      const industry = response.trim();

      return { industry: industry };
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        throw new Error("Failed to extract industry after multiple attempts");
      }
    }
  }
}

module.exports = {
  generateCustomLine,
  generateProfessionalSubject,
  generateJobSummary,
  extractIndustryFromSummary,
};
