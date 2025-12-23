import "abortcontroller-polyfill/dist/abortcontroller-polyfill-only";

const baseUrl = "https://tow.huijiwiki.com/wiki/Data:";
let controller;

const abortFetch = () => {
  controller && controller.abort();
};
export const fetcher = ({ url, onSuccess, onError }) => {
  controller = new AbortController();

  fetch(`${baseUrl}${url}.json?action=raw`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: controller.signal,
  })
    .then((response) => response.json())
    .then((data) => {
      if (onSuccess) {
        onSuccess(data);
      }
    })
    .catch((error) => {
      if (onError) {
        onError(error);
      }
    });
};

export { abortFetch };
