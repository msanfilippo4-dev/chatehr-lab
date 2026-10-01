export function uploadFile(signedUrl: string, file: File, contentType: string, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=0");
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The file transfer failed. Please try again."));
    xhr.onerror = () => reject(new Error("The file transfer could not connect. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The file transfer timed out. Please try again."));
    xhr.send(file);
  });
}
