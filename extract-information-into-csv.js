const fs = require("fs");
const path = require("path");

const prefix = "jsondata-";
const filesInDirectory = fs.readdirSync(__dirname);

// Filter files that start with the prefix
const jsonFiles = filesInDirectory.filter((filename) =>
  filename.startsWith(prefix)
);

if (jsonFiles.length === 0) {
  console.error(
    `No files starting with '${prefix}' found in the current directory.`
  );
  process.exit(1);
}

const allResults = [];

for (const filename of jsonFiles) {
  try {
    const jsonData = fs.readFileSync(path.join(__dirname, filename), "utf8");
    const json = JSON.parse(jsonData);

    let allValuesInComponent = [];

    function findValuesInComponents(type, obj) {
      if (obj && obj.type === type && obj[type]?.items?.length) {
        allValuesInComponent = allValuesInComponent.concat(obj[type].items);
        obj[type].items.forEach((_obj) => {
          if (_obj?.subItems?.length) {
            allValuesInComponent = allValuesInComponent.concat(_obj.subItems);
          }
        });
      } else if (obj && obj.type === type && obj[type]?.stats?.length) {
        allValuesInComponent = allValuesInComponent.concat(obj[type].stats);
      } else if (typeof obj === "object") {
        for (const key in obj) {
          findValuesInComponents(type, obj[key]);
        }
      }
    }

    // Find the breakdownList items
    findValuesInComponents("breakdownList", json);
    findValuesInComponents("statTable", json);
    findValuesInComponents("statList", json);
    findValuesInComponents("subItems", json);

    const filtered = allValuesInComponent.filter((item) => item.label);
    if (filtered.length) {
      // Extract and format data as an object and push to allResults
      const hash = {};
      filtered.forEach((item) => (hash[item.label] = item.value));
      allResults.push(hash);
    } else {
      console.error(`No breakdownList items found in ${filename}.`);
    }
  } catch (error) {
    console.error(`Error reading or parsing ${filename}: ${error.message}`);
  }
}

function convertTimeStringToMinutes(inputString) {
  const parts = inputString.split(" ");

  if (parts.length === 4 && parts[1] === "min" && parts[3] === "sec") {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[2], 10);

    if (isNaN(minutes) || isNaN(seconds)) {
      throw new Error("Invalid numeric values in the input.");
    }

    const decimalMinutes = minutes + seconds / 60;
    return decimalMinutes;
  } else if (parts.length === 2 && parts[1] === "sec") {
    const seconds = parseInt(parts[0], 10);

    if (isNaN(seconds)) {
      throw new Error("Invalid numeric value in the input.");
    }

    const decimalMinutes = seconds / 60;
    return decimalMinutes;
  } else if (parts.length === 4 && parts[1] === "hr" && parts[3] === "min") {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[2], 10);

    if (isNaN(hours) || isNaN(minutes)) {
      throw new Error("Invalid numeric values in the input.");
    }

    const decimalMinutes = hours * 60 + minutes;
    return decimalMinutes;
  } else {
    throw new Error(
      "Invalid input format. Please use 'X min Y sec', 'X sec', or 'X hr Y min'."
    );
  }
}

function convertToGoogleSheetsDatetime(inputString) {
  const dateObj = new Date(inputString);

  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date string format.");
  }

  dateObj.setMinutes(dateObj.getMinutes() - 600);
  const isoDatetime = dateObj.toISOString();
  return isoDatetime;
}

function formatMilesStringToDecimal(inputString) {
  const regex = /^(\d+[\.\d+]*)\s*mi$/;
  const match = inputString.match(regex);

  if (match) {
    const decimalValue = parseFloat(match[1]);
    return decimalValue;
  } else {
    return 0;
  }
}

function sanitizeResults(data) {
  const sanitizedResults = [];
  data.forEach((obj) => {
    const newObj = obj;

    ["Your earnings"].forEach((column) => {
      if (newObj[column]) {
        newObj[column] = newObj[column] * -1;
      }
    });

    ["Your earnings", "Tip", "Customer price", "Wait Time at Pickup"].forEach((column) => {
      if (newObj[column]) {
        newObj[column] = newObj[column] / 100000;
      }
    });

    newObj.Duration = convertTimeStringToMinutes(newObj.Duration);
    newObj.Distance = formatMilesStringToDecimal(newObj.Distance);
    newObj.DateTime = convertToGoogleSheetsDatetime(
      `${newObj["Date Requested"]} ${newObj["Time Requested"]}`
    );

    if (newObj["Tip"]) {
      newObj["Your earnings"] = newObj["Your earnings"] - newObj["Tip"];
    }

    if (newObj["Wait Time at Pickup"]) {
      newObj["Your earnings"] = newObj["Your earnings"] - newObj["Wait Time at Pickup"];
    }

    sanitizedResults.push(newObj);
  });
  return sanitizedResults;
}

const header = [
    "DateTime",
    "Duration",
    "Distance",
    "Your earnings",
    "Tip",
    "Wait Time at Pickup",
    "Admin Minutes",
    "Total Trip Time",
    "Admin Miles",
    "Miles",
    "Time At Stop",
    "Time Pay",
];

console.log(header.join(","));
allResults.forEach((line) => {
  if (!line["Your earnings"]) {
    return;
  }

  const row = header.map((item) => line[item] || "");
  console.log(row.join(","));
});

