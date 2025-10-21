# --- Professional Comments in English ---
# This Flask application serves as the backend for the LinkedIn Games Solver.
# It handles routing for different games and provides Python-based API endpoints
# for computationally intensive tasks like image processing (N-Queens).

from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
from sklearn.cluster import KMeans
import base64

# Initialize the Flask application
app = Flask(__name__)

# --- The Solver Engine (N-Queens) ---
def solve_puzzle_logic(board_map):
    """
    Solves the N-Queens variant puzzle using a backtracking algorithm.
    Takes a numeric map and returns the solution board or None.
    """
    ROWS, COLS = len(board_map), len(board_map[0])
    solution_board = [[0 for _ in range(COLS)] for _ in range(ROWS)]

    def is_safe(board, row, col):
        # Checks using the adjacent-diagonal-only rule
        for i in range(row):
            if board[i][col] == 1: return False
        if row > 0 and col > 0 and board[row-1][col-1] == 1: return False
        if row > 0 and col < COLS - 1 and board[row-1][col+1] == 1: return False
        return True

    def solve(row):
        if row == ROWS: return True
        for col in range(COLS):
            region_id = board_map[row][col]
            is_region_occupied = any(
                solution_board[r][c] == 1 and board_map[r][c] == region_id
                for r in range(row) for c in range(COLS)
            )
            if is_region_occupied: continue
            if is_safe(solution_board, row, col):
                solution_board[row][col] = 1
                if solve(row + 1): return True
                solution_board[row][col] = 0 # Backtrack
        return False

    if solve(0):
        return solution_board
    else:
        return None

# --- Smart Image Processor (N-Queens) ---
def create_map_from_image(image_bytes, rows, cols):
    """
    Analyzes an image using K-Means clustering to identify the main color regions.
    """
    try:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        h, w, _ = img.shape
        cell_h, cell_w = h / rows, w / cols

        cell_colors_bgr = [img[int(r*cell_h+cell_h/2), int(c*cell_w+cell_w/2)] for r in range(rows) for c in range(cols)]

        # Use n_clusters=rows since there are 'n' queens and thus 'n' regions.
        kmeans = KMeans(n_clusters=rows, n_init=10, random_state=0)
        kmeans.fit(cell_colors_bgr)

        official_colors_bgr = kmeans.cluster_centers_
        labels = kmeans.predict(cell_colors_bgr)

        def bgr_to_hex(bgr):
            b, g, r = [int(c) for c in bgr]
            return f'#{r:02x}{g:02x}{b:02x}'

        hex_color_map = [['' for _ in range(cols)] for _ in range(rows)]
        color_index = 0
        for r in range(rows):
            for c in range(cols):
                cluster_id = labels[color_index]
                hex_color_map[r][c] = bgr_to_hex(official_colors_bgr[cluster_id])
                color_index += 1

        print("Successfully generated initial map from image.")
        return hex_color_map
    except Exception as e:
        print(f"Error during image processing: {e}")
        return None

# --- Flask Routes ---

@app.route('/')
@app.route('/game/<game_name>')
def index(game_name='nqueens'):
    """Serves the main HTML page and sets the active game for the frontend."""
    if game_name not in ['nqueens', 'tango']:
        game_name = 'nqueens' # Default to nqueens if URL is invalid
    return render_template('index.html', active_game=game_name)

@app.route('/process', methods=['POST'])
def process_image_route():
    """
    API endpoint for N-Queens image processing. Receives an image and grid size,
    returns a color map for the frontend editor.
    """
    if 'puzzleImage' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['puzzleImage']

    try:
        # Handle both "8" and "8x8" formats
        size_str = request.form.get('gridSize', '8')
        if 'x' in size_str.lower():
            rows, cols = map(int, size_str.lower().split('x'))
        else:
            rows = cols = int(size_str)
    except ValueError:
        return jsonify({'error': 'Invalid grid size format'}), 400

    image_bytes = file.read()
    color_map_hex = create_map_from_image(image_bytes, rows, cols)

    if color_map_hex is None:
        return jsonify({'error': 'Failed to process image.'}), 500

    return jsonify({'colorMap': color_map_hex, 'rows': rows, 'cols': cols})

@app.route('/solve', methods=['POST'])
def solve_route():
    """
    API endpoint for N-Queens solving. Receives a corrected numeric map
    and returns the final solution.
    """
    data = request.get_json()
    board_map = data.get('map')

    if not board_map:
        return jsonify({'error': 'No map data provided'}), 400

    print("Received corrected map for N-Queens, attempting to solve...")
    solution = solve_puzzle_logic(board_map)

    return jsonify({'solution': solution})

# Note: The Tango solver logic is entirely client-side (in script.js)
# so it does not need a specific backend endpoint for solving.

if __name__ == '__main__':
    app.run(debug=True, port=5000)