function read(key) {
  try {
    if (typeof window.localStorage !== "undefined") {
      return JSON.parse(localStorage.getItem(key));
    } else {
      console.log("Local storage is not supported");
    }
  } catch (error) {
    console.log("Error reading from local storage: ", error);
  }
}

function set(key, value) {
  try {
    if (typeof window.localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      console.log("Local storage is not supported");
    }
  } catch (error) {
    console.log("Error saving in local storage: ", error);
  }
}

function useLocalStorageState() {
  return [read, set];
}

module.exports = useLocalStorageState;
