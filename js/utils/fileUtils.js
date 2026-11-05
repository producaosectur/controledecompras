// CONVERSÃO RÁPIDA COM COMPRESSÃO AUTOMÁTICA DE IMAGENS
export const fileToBase64 = file => new Promise((resolve, reject) => {
  if (file.type.startsWith('image/')) {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = img.width;
      let height = img.height;
      const maxDim = 1200;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      resolve(dataUrl.split(',')[1]);
    };

    img.onerror = () => {
      const fallbackReader = new FileReader();
      fallbackReader.readAsDataURL(file);
      fallbackReader.onload = () => resolve(fallbackReader.result.split(',')[1]);
      fallbackReader.onerror = err => reject(err);
    };

    reader.readAsDataURL(file);
  } else {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  }
});

export async function processFileList(fileList) {
  return Promise.all(fileList.map(async item => {
    if (item.url) {
      return { name: item.name, url: item.url };
    } else if (item.fileObj) {
      let base64 = await fileToBase64(item.fileObj);
      return {
        name: item.name,
        mime: item.fileObj.type.startsWith('image/') ? 'image/jpeg' : item.mime,
        base64: base64
      };
    }
  }));
}