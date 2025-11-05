from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from flask import Flask, request, jsonify
from flask_cors import CORS

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

app = Flask(__name__)
CORS(app)  # allows browser extension to call it from localhost

def mask_pii(text):
    """Analyze and anonymize PII in the given text."""
    results = analyzer.analyze(text=text, language='en')
    # Log what was found
    if results:
        print(f"Found PII: {[r.entity_type for r in results]}")
    
    anonymized = anonymizer.anonymize(text=text, analyzer_results=results).text
    return anonymized

@app.route("/mask", methods=["POST"])
def mask():
    """API endpoint to mask PII in text."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        text = data.get("text", "")
        
        if not text or not text.strip():
            return jsonify({"masked": text})
        
        masked = mask_pii(text)
        print(f"Original: {text[:50]}... -> Masked: {masked[:50]}...")
        
        return jsonify({"masked": masked})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    print("Starting PII Masking Server on port 5000...")
    app.run(host='127.0.0.1', port=5000, debug=True)