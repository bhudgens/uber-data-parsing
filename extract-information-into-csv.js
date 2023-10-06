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

const _allResults = [];

for (const filename of jsonFiles) {
  try {
    const jsonData = fs.readFileSync(path.join(__dirname, filename), "utf8");
    const json = JSON.parse(jsonData);

    let _allValuesInComponent = [];

    function findValuesInComponents(type, obj) {
      console.log(obj);
      if (obj && obj.type === type) {
        console.log("---------------here");
        console.log(obj);
      }
      if (obj && obj.type === type && obj[type]?.items?.length) {
        _allValuesInComponent = _allValuesInComponent.concat(obj[type].items);
        obj[type].items.forEach((_obj) => {
          if (_obj?.subItems?.length) {
            _allValuesInComponent = _allValuesInComponent.concat(_obj.subItems);
          }
        });

        console.log("HERE!");
        console.log(type, obj[type], obj[type]?.items?.subItems?.length);
      } else if (obj && obj.type === type && obj[type]?.stats?.length) {
        _allValuesInComponent = _allValuesInComponent.concat(obj[type].stats);
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

    const _filtered = _allValuesInComponent.filter((item) => item.label);
    if (_filtered.length) {
      // Extract and format data as an object and push to _allResults
      const _hash = {};
      _filtered.map((item) => (_hash[item.label] = item.value));
      _allResults.push(_hash);
    } else {
      console.error(`No breakdownList items found in ${filename}.`);
    }
  } catch (error) {
    console.error(`Error reading or parsing ${filename}: ${error.message}`);
  }
}

function convertTimeStringToMinutes(inputString) {
  console.log(inputString);
  // Split the input string into parts based on spaces
  const parts = inputString.split(" ");

  if (parts.length === 4 && parts[1] === "min" && parts[3] === "sec") {
    // Input format is "X min Y sec"
    const minutes = parseInt(parts[0], 10); // Extract minutes as an integer
    const seconds = parseInt(parts[2], 10); // Extract seconds as an integer

    if (isNaN(minutes) || isNaN(seconds)) {
      // Invalid numeric values
      throw new Error("Invalid numeric values in the input.");
    }

    // Calculate the decimal representation of minutes
    const decimalMinutes = minutes + seconds / 60;
    return decimalMinutes;
  } else if (parts.length === 2 && parts[1] === "sec") {
    // Input format is "X sec" (only seconds, no minutes)
    const seconds = parseInt(parts[0], 10); // Extract seconds as an integer

    if (isNaN(seconds)) {
      // Invalid numeric value
      throw new Error("Invalid numeric value in the input.");
    }

    // Convert seconds to minutes with a decimal
    const decimalMinutes = seconds / 60;
    return decimalMinutes;
  } else if (parts.length === 4 && parts[1] === "hr" && parts[3] === "min") {
    // Input format is "X hr Y min"
    const hours = parseInt(parts[0], 10); // Extract hours as an integer
    const minutes = parseInt(parts[2], 10); // Extract minutes as an integer

    if (isNaN(hours) || isNaN(minutes)) {
      // Invalid numeric values
      throw new Error("Invalid numeric values in the input.");
    }

    // Calculate the decimal representation of minutes
    const decimalMinutes = hours * 60 + minutes;
    return decimalMinutes;
  } else {
    // Invalid input format
    throw new Error(
      "Invalid input format. Please use 'X min Y sec', 'X sec', or 'X hr Y min'."
    );
  }
}


function convertToGoogleSheetsDatetime(inputString) {
  const dateObj = new Date(inputString);

  if (isNaN(dateObj.getTime())) {
    // Invalid date string
    throw new Error("Invalid date string format.");
  }

  dateObj.setMinutes(dateObj.getMinutes() - 600);
  const isoDatetime = dateObj.toISOString();
  return isoDatetime;
}

function formatMilesStringToDecimal(inputString) {
  // Use a regular expression to match the expected format "X.X mi"
  const regex = /^(\d+[\.\d+]*)\s*mi$/;

  const match = inputString.match(regex);

  if (match) {
    // Extract the decimal value from the matched string
    const decimalValue = parseFloat(match[1]);
    return decimalValue;
  } else {
    // Return 0 for invalid formats
    return 0;
  }
}

function sanitizeResults(data) {
  const _sanatizedResults = [];
  data.forEach((obj) => {
    const _newObj = obj;

    ["Your earnings"].forEach((column) => {
      if (_newObj[column]) {
        _newObj[column] = _newObj[column] * -1;
      }
    });

    ["Your earnings", "Tip", "Customer price", "Wait Time at Pickup"].forEach((column) => {
      if (_newObj[column]) {
        _newObj[column] = _newObj[column] / 100000;
      }
    });

    console.log(obj);
    _newObj.Duration = convertTimeStringToMinutes(_newObj.Duration);
    _newObj.Distance = formatMilesStringToDecimal(_newObj.Distance);
    _newObj.DateTime = convertToGoogleSheetsDatetime(
      `${_newObj["Date Requested"]} ${_newObj["Time Requested"]}`
    );

    if (_newObj["Tip"]) {
      _newObj["Your earnings"] = _newObj["Your earnings"] - _newObj["Tip"];
    }

    if (_newObj["Wait Time at Pickup"]) {
      _newObj["Your earnings"] = _newObj["Your earnings"] - _newObj["Wait Time at Pickup"];
    }

    _sanatizedResults.push(_newObj);
  });
  return _sanatizedResults;
}

console.log("_allResults:", _allResults);
const _sanitized = sanitizeResults(_allResults);
console.log("_sanitized:", _sanitized);

const _header = [];
[
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
].forEach((item) => {
  _header.push(item);
});
console.log(_header.join(","));
_sanitized.forEach((line) => {
  if (!line["Your earnings"]) {
    return;
  }

  const _line = [];
  [
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
  ].forEach((item) => {
    _line.push(line[item] || "");
  });
  console.log(_line.join(","));
});
