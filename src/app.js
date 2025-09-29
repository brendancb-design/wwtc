/* === WWTC Main (clean, canonical) === */
/* Layers */
const providerConsumers = require('/opt/nodejs/providerConsumers');
const enums = require('/opt/nodejs/enums');
const { success, failure } = require('/opt/nodejs/utils');

/* Idempotent helpers: safe on re-eval in warm Lambdas */
var normLang = globalThis.normLang || function(code){
  if (!code) return code;
  return String(code).toLowerCase().split(/[-_]/)[0];
};

var priorityLangs = globalThis.priorityLangs || (globalThis.priorityLangs = {
  en: { code: 'en', ttt: true, stt: true, tts: true },
  es: { code: 'es', ttt: true, stt: true, tts: true }
});

var resolveLang = globalThis.resolveLang || function(code){
  if (!code) return null;
  const c = normLang(code);
  if (priorityLangs[c]) return priorityLangs[c];
  return null;
};

/* AWS Translate fallback */
const AWS = require('aws-sdk');
const _tttClient = new AWS.Translate({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1' });
async function awsTranslateTTT(src, tgt, text) {
  const params = { SourceLanguageCode: src.code, TargetLanguageCode: tgt.code, Text: text };
  const res = await _tttClient.translateText(params).promise();
  return res && res.TranslatedText;
}

/* Service helpers */
const serviceRequiresAudio = (serviceCode) => {
  return [enums.serviceCodes.sts, enums.serviceCodes.stt].includes(serviceCode);
};
const serviceIsOffered = (serviceCode) => {
  return Object.values(enums.serviceCodes).includes(serviceCode);
};
const serviceReturnsText = (serviceCode) => {
  return [enums.serviceCodes.stt, enums.serviceCodes.ttt].includes(serviceCode);
};
const serviceReturnsAudio = (serviceCode) => {
  return [enums.serviceCodes.sts, enums.serviceCodes.tts].includes(serviceCode);
};
const getText = (queryString, body) => {
  if (queryString && queryString.text) return queryString.text;
  return body.text;
};

/* Handler */
exports.lambdaHandler = async (event, context) => {
  try {
    const { serviceCode } = event.pathParameters;
    let sourceLanguageCode = normLang(event.pathParameters.sourceLanguageCode);
    let targetLanguageCode = normLang(event.pathParameters.targetLanguageCode);
    const body = event.body;

    let text = serviceRequiresAudio(serviceCode)
      ? ''
      : getText(event.queryStringParameters, JSON.parse(body));

    const data = { source_text: '', translated_text: '', audio: '' };

    if (serviceIsOffered(serviceCode)) {
      // Map languages WITHOUT DB
      const sourceLanguage = resolveLang(sourceLanguageCode);
      const targetLanguage = resolveLang(targetLanguageCode);

      if (!sourceLanguage) return failure('Source language not found');
      if (!targetLanguage) return failure('Target language not found');

      if (serviceRequiresAudio(serviceCode)) {
        if (!body) return failure('Audio is required for audio transcription');
        const audioTranscript = await providerConsumers.STT(sourceLanguage, body);
        if (!audioTranscript) return failure('STT not available');
        text = audioTranscript;
      }

      if (!text) return failure('Text is required for translation');
      data.source_text = text;

      let translatedText;
      if (sourceLanguage && sourceLanguage.ttt && targetLanguage && targetLanguage.ttt) {
  translatedText = await awsTranslateTTT(sourceLanguage, targetLanguage, text);
} else {
  translatedText = text;
}
      if (!translatedText) return failure('TTT not available');
      data.translated_text = translatedText;

      if (serviceReturnsText(serviceCode)) {
        return success(data);
      }

      const audio = await providerConsumers.TTS(targetLanguage, translatedText);
      if (!audio) return failure('TTS not available');
      data.audio = audio;

      if (serviceReturnsAudio(serviceCode)) {
        return success(data);
      }
    }
    return failure('Service not found');
  } catch (err) {
    console.log('An error occurred while processing the request');
    console.log(err);
    return failure(err);
  }
};
