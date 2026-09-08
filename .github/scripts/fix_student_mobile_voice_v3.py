from pathlib import Path

path = Path('app/student/page.tsx')
text = path.read_text(encoding='utf-8')

text = text.replace('''    window.speechSynthesis.cancel();\n    const utterance = new SpeechSynthesisUtterance(text);''', '''    const synth = window.speechSynthesis;\n    synth.resume();\n    const utterance = new SpeechSynthesisUtterance(text);''')
text = text.replace('''    const voices = window.speechSynthesis.getVoices();''', '''    const voices = synth.getVoices();''')
text = text.replace('''    window.speechSynthesis.speak(utterance);''', '''    synth.speak(utterance);''')

text = text.replace('''  async function lookup(codeValue: string) {\n    speakLoginGreeting("student");''', '''  async function lookup(codeValue: string, shouldSpeak = false) {\n    if (shouldSpeak) speakLoginGreeting("student");''')
text = text.replace('''    void lookup(accessCode);''', '''    void lookup(accessCode, true);''')
text = text.replace('''      void lookup(code);''', '''      void lookup(code, false);''')

path.write_text(text, encoding='utf-8')
print('Student mobile voice cleaned: one submit trigger, no auto-page greeting, no pre-speak cancel.')
