import os
os.environ['SUPERTONIC_CACHE_DIR'] = '/opt/jarvis/vendor/supertonic3'
from supertonic import TTS
engine = TTS(model='supertonic-3', auto_download=True, intra_op_num_threads=4)
print('Supertonic ready:', engine.voice_style_names)
