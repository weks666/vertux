import {buildTerminalStudyExplanation} from './terminal-study-explanation.js';

// Compatibility entry point for the original, strictly SMA-only contract.
export function buildTerminalSmaExplanation(input,studyId){
 const report=buildTerminalStudyExplanation(input,studyId,{supportedTypes:['sma']});
 return Object.freeze({...report,contractVersion:'terminal-sma-explanation-v1',intent:'terminal.sma-method'});
}
