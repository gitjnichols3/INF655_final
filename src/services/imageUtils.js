export function resizeImage(file, maxWidth, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const scale = maxWidth / img.width;
      const width = img.width > maxWidth ? maxWidth : img.width;
      const height = img.width > maxWidth ? img.height * scale : img.height;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image resize failed"));
            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = reject;
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}