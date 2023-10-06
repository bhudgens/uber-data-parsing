const fs = require("fs");
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

// Get the file paths from the command line arguments
const htmlFilePath = process.argv[2];
const curlCommandFilePath = process.argv[3];

// Read the HTML content from the specified HTML file
fs.readFile(htmlFilePath, "utf8", (err, html) => {
  if (err) {
    console.error("Error reading the HTML file:", err);
    process.exit(1);
  }

  // Load the HTML content using Cheerio
  const $ = cheerio.load(html);

  // Find all anchor tags (links) with an href attribute containing "https://drivers.uber.com/earnings/trips"
  const urls = [];
  $('a[href*="https://drivers.uber.com/earnings/trips"]').each(
    (index, element) => {
      const url = $(element).attr("href");
      urls.push(url);
    }
  );

  // Read the curl command from the specified file
  fs.readFile(curlCommandFilePath, "utf8", (err, curlCommand) => {
    if (err) {
      console.error("Error reading the curl command file:", err);
      process.exit(1);
    }

    // Extract the tripUUID from each URL (assuming it's the last segment)
    const axiosRequests = urls.map(async (url) => {
      const tripUUID = url.split("/").pop();

      const data = JSON.stringify({ tripUUID });

      // Parse the curl command to extract headers and data
      const lines = curlCommand.split("\n");
      console.log("lines:", lines);
      const axiosConfig = {
        method: "post", // Change this to 'get' if it's a GET request
        url: /'([^']+)'/.exec(lines[0])?.[1],
        headers: {},
        data,
      };

      // Extract headers from the curl command
      lines.slice(1, -2).forEach((line) => {
        console.log("line:", line);
        const parts = line
          .replace(/.*?'/, "")
          .replace(/'.*/, "")
          .split(":");
        const key = parts.shift();
        const value = parts.join(":");
        axiosConfig.headers[key.trim()] = value.trim();
      });

      // Make the Axios request
      console.log("axiosConfig:", axiosConfig);
      try {
        const response = await axios(axiosConfig);
        console.log(`Response for URL: ${url}`);
        // Save the response to a file
        fs.writeFile(`jsondata-${tripUUID}.json`, JSON.stringify(response.data, null, 2), (err) => {
          if (err) {
            console.error("Error writing response to file:", err);
          }
        });
      } catch (error) {
        console.error(`Error fetching URL: ${url}`, error);
      }
    });

    // Wait for all Axios requests to complete
    Promise.all(axiosRequests)
      .then(() => {
        console.log("All requests completed.");
      })
      .catch((error) => {
        console.error("Error making requests:", error);
      });
  });
});


