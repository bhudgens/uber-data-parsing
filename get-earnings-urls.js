const fs = require("fs").promises;
const path = require("path");
const cheerio = require("cheerio");
const axios = require("axios");

// Check if two file paths are provided as arguments
if (process.argv.length < 4) {
  console.error(
    "Usage: node extractAndAxios.js <html_file_path> <curl_command_file_path>"
  );
  process.exit(1);
}

async function main() {
  try {
    // Get the file paths from the command line arguments
    const [htmlFilePath, curlCommandFilePath] = process.argv.slice(2);

    // Read the HTML content from the specified HTML file
    const html = await fs.readFile(htmlFilePath, "utf8");

    // Load the HTML content using Cheerio
    const $ = cheerio.load(html);

    // Find all anchor tags (links) with an href attribute containing "https://drivers.uber.com/earnings/trips"
    const urls = $('a[href*="https://drivers.uber.com/earnings/trips"]').map((index, element) =>
      $(element).attr("href")
    ).get();

    // Read the curl command from the specified file
    const curlCommand = await fs.readFile(curlCommandFilePath, "utf8");

    // Extract the tripUUID from each URL (assuming it's the last segment)
    const axiosRequests = urls.map(async (url) => {
      const tripUUID = url.split("/").pop();
      const data = JSON.stringify({ tripUUID });

      // Parse the curl command to extract headers and data
      const lines = curlCommand.split("\n");
      const urlMatch = /'([^']+)'/.exec(lines[0]);
      const axiosConfig = {
        method: "post", // Change this to 'get' if it's a GET request
        url: urlMatch?.[1],
        headers: {},
        data,
      };

      // Extract headers from the curl command
      lines.slice(1, -2).forEach((line) => {
        const [key, ...valueParts] = line.replace(/.*?'/, "").split(":");
        axiosConfig.headers[key.trim()] = valueParts.join(":").trim();
      });

      // Make the Axios request
      try {
        const response = await axios(axiosConfig);
        console.log(`Response for URL: ${url}`);
        // Save the response to a file
        await fs.writeFile(`jsondata-${tripUUID}.json`, JSON.stringify(response.data, null, 2));
      } catch (error) {
        console.error(`Error fetching URL: ${url}`, error);
      }
    });

    // Wait for all Axios requests to complete
    await Promise.all(axiosRequests);
    console.log("All requests completed.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();

