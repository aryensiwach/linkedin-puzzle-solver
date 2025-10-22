document.addEventListener('DOMContentLoaded', () => {
    // Determine the active game from the global variable set in index.html
    const activeGameName = window.ACTIVE_GAME || 'nqueens'; 
    
    // --- N-QUEENS SOLVER (Existing Logic Encapsulated) ---
    const NQueensApp = {
        // Elements used by N-Queens
        uploadForm: document.getElementById('upload-form'),
        editorContainer: document.getElementById('editor-container'),
        resultContainer: document.getElementById('result-container'),
        loader: document.getElementById('loader'),
        paletteContainer: document.getElementById('palette'),
        gridContainer: document.getElementById('grid-container'),
        solveBtn: document.getElementById('solve-btn'),
        solutionGrid: document.getElementById('solution-grid'),
        imageInput: document.getElementById('puzzle-image'),

        // State variables
        currentRows: 0,
        currentCols: 0,
        selectedColor: null,

        init: function() {
            if (!this.uploadForm) return; // Only initialize if the element exists
            
            // Set up event listeners for N-Queens
            this.uploadForm.addEventListener('submit', this.processImage.bind(this));
            this.solveBtn.addEventListener('click', this.solvePuzzle.bind(this));
            this.editorContainer.classList.add('hidden');
            this.resultContainer.classList.add('hidden');
        },

        processImage: async function(event) {
            event.preventDefault();
            const imageFile = this.imageInput.files[0];

            if (!imageFile) { alert('Please select an image file first.'); return; }
            if (!imageFile.type.startsWith('image/')) { alert('Invalid file type. Please upload an image (PNG, JPG, etc.).'); return; }

            const processBtn = this.uploadForm.querySelector('button');
            processBtn.disabled = true;
            this.loader.classList.remove('hidden');
            this.editorContainer.classList.add('hidden');
            this.resultContainer.classList.add('hidden');

            const formData = new FormData(this.uploadForm);
            
            try {
                const response = await fetch('/process', { method: 'POST', body: formData });
                const result = await response.json();

                if (response.ok) {
                    this.populateEditor(result.colorMap, result.rows, result.cols);
                    this.editorContainer.classList.remove('hidden');
                } else {
                    alert(`Error: ${result.error || 'Failed to process image.'}`);
                }
            } catch (error) {
                console.error('Processing Error:', error);
                alert('An error occurred while communicating with the server.');
            } finally {
                this.loader.classList.add('hidden');
                processBtn.disabled = false;
            }
        },

        populateEditor: function(colorMap, rows, cols) {
            this.currentRows = rows;
            this.currentCols = cols;

            const uniqueColors = [...new Set(colorMap.flat())];
            if (uniqueColors.length === 0) { alert("Could not detect any colors in the image."); return; }
            
            this.selectedColor = uniqueColors[0];
            this.paletteContainer.innerHTML = '';

            uniqueColors.forEach((color, index) => {
                const colorBox = document.createElement('div');
                colorBox.className = 'color-box';
                colorBox.style.backgroundColor = color;
                if (index === 0) colorBox.classList.add('selected');
                
                colorBox.addEventListener('click', () => {
                    this.selectedColor = color;
                    document.querySelectorAll('.color-box').forEach(box => box.classList.remove('selected'));
                    colorBox.classList.add('selected');
                });
                this.paletteContainer.appendChild(colorBox);
            });

            
            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Clear Grid';
            clearBtn.style.cssText = 'background-color: var(--text-muted); width: auto; margin-left: 1rem;';
            clearBtn.addEventListener('click', () => {
                 document.querySelectorAll('#grid-container .grid-cell').forEach(cell => {
                     cell.style.backgroundColor = 'rgb(255, 255, 255)'; 
                 });
            });
            this.paletteContainer.appendChild(clearBtn);


            const table = document.createElement('table');
            table.className = 'grid-table';
            
            for (let i = 0; i < rows; i++) {
                const tr = document.createElement('tr');
                for (let j = 0; j < cols; j++) {
                    const td = document.createElement('td');
                    td.className = 'grid-cell';
                    td.style.backgroundColor = colorMap[i][j];
                    td.addEventListener('click', () => {
                        td.style.backgroundColor = this.selectedColor;
                    });
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
            
            this.gridContainer.innerHTML = '';
            this.gridContainer.appendChild(table);
        },

        solvePuzzle: async function() {
            this.solveBtn.disabled = true;
            this.loader.classList.remove('hidden');
            this.resultContainer.classList.add('hidden');

            const cells = document.querySelectorAll('#grid-container .grid-cell');
            const colorIdMap = {};
            let nextId = 0;
            const numericMap = Array(this.currentRows).fill(null).map(() => Array(this.currentCols).fill(-1));
            
            let cellIndex = 0;
            for (let r = 0; r < this.currentRows; r++) {
                for (let c = 0; c < this.currentCols; c++) {
                    const bgColor = cells[cellIndex].style.backgroundColor.toLowerCase(); 
                    if (!colorIdMap.hasOwnProperty(bgColor)) {
                        colorIdMap[bgColor] = nextId++;
                    }
                    numericMap[r][c] = colorIdMap[bgColor];
                    cellIndex++;
                }
            }
            
            if (Object.keys(colorIdMap).length !== this.currentRows) {
                if (!confirm(`Warning: Found ${Object.keys(colorIdMap).length} unique regions, but expected ${this.currentRows}. The puzzle might be unsolvable. Continue anyway?`)) {
                    this.loader.classList.add('hidden');
                    this.solveBtn.disabled = false;
                    return;
                }
            }

            try {
                const response = await fetch('/solve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ map: numericMap }),
                });
                const result = await response.json();

                if (response.ok) {
                    if (result.solution) {
                        const originalColorMap = [];
                        cellIndex = 0;
                        for (let r = 0; r < this.currentRows; r++) {
                            const row = [];
                            for(let c = 0; c < this.currentCols; c++){
                                row.push(cells[cellIndex].style.backgroundColor);
                                cellIndex++;
                            }
                            originalColorMap.push(row);
                        }
                        this.displaySolution(result.solution, originalColorMap, this.currentRows, this.currentCols);
                    } else {
                        alert('No solution found! Please check if your corrected map is logical (e.g., no two regions are entirely in the same row).');
                    }
                } else {
                    alert(`Error: ${result.error || 'Solver failed.'}`);
                }
            } catch (error) {
                 console.error('Solving Error:', error);
                 alert('An error occurred while solving the puzzle.');
            } finally {
                 this.loader.classList.add('hidden');
                 this.solveBtn.disabled = false;
            }
        },

        displaySolution: function(solution, colorMap, rows, cols) {
            const table = document.createElement('table');
            table.className = 'solution-table';

            for (let r = 0; r < rows; r++) {
                const tr = document.createElement('tr');
                for (let c = 0; c < cols; c++) {
                    const td = document.createElement('td');
                    td.className = 'solution-cell';
                    td.style.backgroundColor = colorMap[r][c];
                    if (solution[r][c] === 1) {
                        td.textContent = '♕';
                    }
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }

            this.solutionGrid.innerHTML = '';
            this.solutionGrid.appendChild(table);
            this.resultContainer.classList.remove('hidden');
        }
    }; // End NQueensApp
    // --- THEME TOGGLE LOGIC ---
const themeToggle = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme');

// Page load hone par check karo ki koi theme saved hai ya nahi
if (currentTheme === 'light') {
    document.body.classList.add('light-mode');
    themeToggle.checked = true;
}

// Toggle par event listener lagao
themeToggle.addEventListener('change', function() {
    if (this.checked) {
        // Light mode on karo aur preference save karo
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
    } else {
        // Light mode hatao aur preference save karo
        document.body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
    }
});
// --- END OF THEME LOGIC ---

    // --- TANGO SOLVER (New Logic) ---
    const TangoApp = {
        // Constants for Tango
        EMPTY: -1,
        SUN: 0,
        MOON: 1,
        
        // Elements
        gridContainer: document.getElementById('tango-grid-area'),
        createBtn: document.getElementById('tango-create-grid-btn'),
        solveBtn: document.getElementById('tango-solve-btn'),
        resetBtn: document.getElementById('tango-reset-btn'),
        sizeInput: document.getElementById('tango-grid-size'),
        statusMsg: document.getElementById('tango-status-message'),
        
        // State
        N: 0,
        grid: [],
        constraints: [],
        isSolving: false,

        init: function() {
            if (!this.createBtn) return;
            this.createBtn.addEventListener('click', this.setGridSize.bind(this));
            this.solveBtn.addEventListener('click', this.solvePuzzle.bind(this));
            this.resetBtn.addEventListener('click', this.resetGrid.bind(this));
            
            // Initial call to set up default 6x6 grid on load
            this.setGridSize(); 
        },

        setGridSize: function() {
            const newN = parseInt(this.sizeInput.value);

            if (isNaN(newN) || newN < 4 || newN % 2 !== 0) {
                alert("Grid size (N) must be an even number (4, 6, 8, etc.) and at least 4.");
                return;
            }

            this.N = newN;
            this.initGrid();
            this.renderGrid();
            this.solveBtn.disabled = false;
            this.statusMsg.textContent = `Grid ${this.N}x${this.N} ready. Set values and constraints.`;
            this.statusMsg.className = "status-message text-green-500 font-bold";
        },

        initGrid: function() {
            this.grid = Array.from({ length: this.N }, () => Array(this.N).fill(this.EMPTY));
            // 2*N is for N vertical constraints (0..N-1) and N horizontal constraints (N..2N-1)
            this.constraints = Array.from({ length: this.N }, () => Array(2 * this.N).fill('N')); 
        },

        resetGrid: function() {
            if (this.N === 0) return;
            this.initGrid();
            this.renderGrid();
            this.statusMsg.textContent = `Grid ${this.N}x${this.N} cleared.`;
            this.statusMsg.className = "status-message text-yellow-500 font-bold";
        },

        // --- UI Rendering ---

        getConstraintClasses: function(type) {
            let base = "tango-constraint-button select-none";
            if (type === 'E') return base + " tango-constraint-equal";
            if (type === 'O') return base + " tango-constraint-opposite";
            return base + " tango-constraint-none";
        },

        renderGrid: function() {
            this.gridContainer.innerHTML = '';
            
            const gridDiv = document.createElement('div');
            gridDiv.id = 'tango-grid';
            
            // CSS Grid setup for N cells and N-1 constraints/spacers
            gridDiv.style.setProperty('--N-cols', this.N * 2 - 1);
            gridDiv.style.setProperty('--N-rows', this.N * 2 - 1);

            for (let r = 0; r < this.N * 2 - 1; r++) {
                for (let c = 0; c < this.N * 2 - 1; c++) {
                    const cellDiv = document.createElement('div');

                    // 1. Cell (at even rows/cols)
                    if (r % 2 === 0 && c % 2 === 0) {
                        const cell_r = r / 2;
                        const cell_c = c / 2;
                        const value = this.grid[cell_r][cell_c];
                        
                        let cellClass = 'tango-cell-button';
                        let content = '';

                        if (value === this.SUN) { cellClass += ' tango-cell-sun'; content = '🌞'; }
                        else if (value === this.MOON) { cellClass += ' tango-cell-moon'; content = '🌙'; }
                        else { cellClass += ' tango-cell-empty'; }
                        
                        cellDiv.className = cellClass;
                        cellDiv.textContent = content;
                        cellDiv.onclick = () => this.toggleCell(cell_r, cell_c);
                    } 
                    // 2. Vertical Constraint (at odd rows, even cols)
                    else if (r % 2 !== 0 && c % 2 === 0) {
                        const const_r = (r - 1) / 2;
                        const const_c = c / 2;
                        const type = this.constraints[const_r][const_c];
                        
                        cellDiv.className = `${this.getConstraintClasses(type)} tango-constraint-vertical`;
                        cellDiv.textContent = type === 'N' ? '' : type === 'E' ? '=' : 'x';
                        cellDiv.onclick = () => this.toggleConstraint(const_r, const_c, 'V');
                    }
                    // 3. Horizontal Constraint (at even rows, odd cols)
                    else if (r % 2 === 0 && c % 2 !== 0) {
                        const const_r = r / 2;
                        const const_c = (c - 1) / 2;
                        const type = this.constraints[const_r][const_c + this.N]; 
                        
                        cellDiv.className = `${this.getConstraintClasses(type)} tango-constraint-horizontal`;
                        cellDiv.textContent = type === 'N' ? '' : type === 'E' ? '=' : 'x';
                        cellDiv.onclick = () => this.toggleConstraint(const_r, const_c, 'H');
                    } 
                    // 4. Spacer (at odd rows/cols)
                    else {
                        cellDiv.style.backgroundColor = 'var(--tango-gap-color)'; 
                        cellDiv.style.width = '10px';
                        cellDiv.style.height = '10px';
                    }
                    gridDiv.appendChild(cellDiv);
                }
            }
            this.gridContainer.innerHTML = '';
            this.gridContainer.appendChild(gridDiv);
        },

        toggleCell: function(r, c) {
            if (this.isSolving) return;
            // Cycles: EMPTY (-1) -> SUN (0) -> MOON (1) -> EMPTY (-1)
            const current = this.grid[r][c];
            this.grid[r][c] = (current + 2) % 3 - 1; 
            this.renderGrid();
        },

        toggleConstraint: function(r, c, orientation) {
            if (this.isSolving) return;
            const idx = c + (orientation === 'H' ? this.N : 0);
            const current = this.constraints[r][idx];
            let next = 'N';

            // Cycles: None (N) -> Equal (E) -> Opposite (O) -> None (N)
            if (current === 'N') next = 'E';
            else if (current === 'E') next = 'O';
            else next = 'N'; 
            
            this.constraints[r][idx] = next;
            this.renderGrid();
        },

        // --- SOLVER LOGIC ---
        findNextEmpty: function(g, r, c) {
            // Searches from (r, c) onwards for the next empty cell
            for (let row = r; row < this.N; row++) {
                const startCol = (row === r) ? c : 0;
                for (let col = startCol; col < this.N; col++) {
                    if (g[row][col] === this.EMPTY) {
                        return {r: row, c: col};
                    }
                }
            }
            // Base case: return N, N if grid is full
            return {r: this.N, c: this.N};
        },

        checkRelationalConstraints: function(g, r, c) {
            const currentVal = g[r][c];
            
            // Check Vertical (constraint stored at r, c for cell below, and r-1, c for cell above)
            // Check below (Constraint at r, c)
            if (r < this.N - 1 && g[r + 1][c] !== this.EMPTY) {
                const constraint = this.constraints[r][c];
                if (constraint !== 'N') {
                    const isSame = (currentVal === g[r + 1][c]);
                    if (constraint === 'E' && !isSame) return false; // Must be Equal, but isn't
                    if (constraint === 'O' && isSame) return false;  // Must be Opposite, but isn't
                }
            }
            // Check above (Constraint at r-1, c)
            if (r > 0 && g[r - 1][c] !== this.EMPTY) {
                const constraint = this.constraints[r - 1][c];
                if (constraint !== 'N') {
                    const isSame = (currentVal === g[r - 1][c]);
                    if (constraint === 'E' && !isSame) return false;
                    if (constraint === 'O' && isSame) return false;
                }
            }

            // Check Horizontal (constraint stored at r, c+N for cell right, and r, c-1+N for cell left)
            // Check right (Constraint at r, c+N)
            if (c < this.N - 1 && g[r][c + 1] !== this.EMPTY) {
                const constraint = this.constraints[r][c + this.N];
                if (constraint !== 'N') {
                    const isSame = (currentVal === g[r][c + 1]);
                    if (constraint === 'E' && !isSame) return false;
                    if (constraint === 'O' && isSame) return false;
                }
            }
            // Check left (Constraint at r, c-1+N)
            if (c > 0 && g[r][c - 1] !== this.EMPTY) {
                const constraint = this.constraints[r][c - 1 + this.N];
                if (constraint !== 'N') {
                    const isSame = (currentVal === g[r][c - 1]);
                    if (constraint === 'E' && !isSame) return false;
                    if (constraint === 'O' && isSame) return false;
                }
            }
            return true;
        },

        checkNoTriples: function(g, r, c) {
            const symbol = g[r][c];
            
            // Horizontal Check (xxx or 000)
            if (c >= 1 && c < this.N - 1 && g[r][c - 1] === symbol && g[r][c + 1] === symbol) return false; 
            if (c >= 2 && g[r][c - 2] === symbol && g[r][c - 1] === symbol) return false;
            if (c <= this.N - 3 && g[r][c + 1] === symbol && g[r][c + 2] === symbol) return false;

            // Vertical Check (stacked xxx or 000)
            if (r >= 1 && r < this.N - 1 && g[r - 1][c] === symbol && g[r + 1][c] === symbol) return false;
            if (r >= 2 && g[r - 2][c] === symbol && g[r - 1][c] === symbol) return false;
            if (r <= this.N - 3 && g[r + 1][c] === symbol && g[r + 2][c] === symbol) return false;
            
            return true;
        },

        checkEqualCount: function(g, r, c) {
            const limit = this.N / 2;
            
            // Row Check (Pruning: check if count already exceeds limit)
            let rowCounts = { [this.SUN]: 0, [this.MOON]: 0 };
            for (const val of g[r]) {
                if (val !== this.EMPTY) rowCounts[val]++;
            }
            if (rowCounts[this.SUN] > limit || rowCounts[this.MOON] > limit) return false; 
            
            // Column Check (Pruning: check if count already exceeds limit)
            let colCounts = { [this.SUN]: 0, [this.MOON]: 0 };
            for (let row = 0; row < this.N; row++) {
                if (g[row][c] !== this.EMPTY) colCounts[g[row][c]]++;
            }
            if (colCounts[this.SUN] > limit || colCounts[this.MOON] > limit) return false;
            
            return true;
        },
        
        isPlacementSafe: function(g, r, c) {
            // Check order matters for efficiency (local checks first)
            if (!this.checkNoTriples(g, r, c)) return false;
            if (!this.checkRelationalConstraints(g, r, c)) return false; 
            if (!this.checkEqualCount(g, r, c)) return false;
            return true;
        },

        isValidSolution: function(g) {
            const limit = this.N / 2;
            
            // 1. Final Equal Count Check (must be EXACTLY limit)
            for (let i = 0; i < this.N; i++) {
                let sun_in_row = 0;
                let moon_in_row = 0;
                let sun_in_col = 0;
                let moon_in_col = 0;

                for (let j = 0; j < this.N; j++) {
                    // Row
                    if (g[i][j] === this.SUN) sun_in_row++;
                    else if (g[i][j] === this.MOON) moon_in_row++;

                    // Column
                    if (g[j][i] === this.SUN) sun_in_col++;
                    else if (g[j][i] === this.MOON) moon_in_col++;
                }

                if (sun_in_row !== limit || moon_in_row !== limit) return false;
                if (sun_in_col !== limit || moon_in_col !== limit) return false;
            }
            
            // 2. Final Relational Constraints Check (Triple check is handled by isPlacementSafe when filling)
            for (let r = 0; r < this.N; r++) {
                for (let c = 0; c < this.N; c++) {
                    // Vertical constraint check (below)
                    if (r < this.N - 1) {
                        const constraint = this.constraints[r][c];
                        if (constraint !== 'N') {
                            const isSame = (g[r][c] === g[r+1][c]);
                            if (constraint === 'E' && !isSame) return false;
                            if (constraint === 'O' && isSame) return false;
                        }
                    }
                    
                    // Horizontal constraint check (right)
                    if (c < this.N - 1) {
                        const constraint = this.constraints[r][c + this.N];
                        if (constraint !== 'N') {
                            const isSame = (g[r][c] === g[r][c+1]);
                            if (constraint === 'E' && !isSame) return false;
                            if (constraint === 'O' && isSame) return false;
                        }
                    }
                }
            }
            
            return true;
        },

        // Main Backtracking function
        solve: function(g, r, c) {
            // Find next empty cell, or base case if full
            const next = this.findNextEmpty(g, r, c);
            
            if (next.r === this.N) {
                // Grid is full, perform final solution validity check
                return this.isValidSolution(g);
            }
            
            const [r_next, c_next] = [next.r, next.c];

            // Try SUN (0) then MOON (1)
            for (const symbol of [this.SUN, this.MOON]) {
                g[r_next][c_next] = symbol;
                
                if (this.isPlacementSafe(g, r_next, c_next)) {
                    // If placement is safe, recurse
                    if (this.solve(g, r_next, c_next)) {
                        return true;
                    }
                }
                
                g[r_next][c_next] = this.EMPTY; // Backtrack
            }
            
            return false;
        },

        solvePuzzle: function() {
            if (this.N === 0 || this.isSolving) return;
            
            // Make a deep copy of the current grid to solve
            const solvedGrid = this.grid.map(row => [...row]);
            const start = this.findNextEmpty(solvedGrid, 0, 0);

            if (start.r === this.N) {
                alert(this.isValidSolution(solvedGrid) ? "Grid already solved and valid" : "Grid full but invalid.");
                return;
            }

            this.isSolving = true;
            this.solveBtn.disabled = true;
            this.statusMsg.textContent = "Solving... ";
            this.statusMsg.className = "status-message text-yellow-500 font-bold";
            
            // Use setTimeout to allow UI to update (show loading message) before starting heavy computation
            setTimeout(() => {
                if (this.solve(solvedGrid, 0, 0)) {
                    this.grid = solvedGrid;
                    this.renderGrid();
                    this.statusMsg.textContent = "Solved! ";
                    this.statusMsg.className = "status-message text-green-500 font-bold";
                } else {
                    this.statusMsg.textContent = "Solution not found, check grid again";
                    this.statusMsg.className = "status-message text-red-500 font-bold";
                }
                this.isSolving = false;
                this.solveBtn.disabled = false;
            }, 10);
        }

    }; // End TangoApp

    // --- Main App Initialization ---
    function initApp() {
        // Hide both containers initially
        const nqueensApp = document.getElementById('nqueens-app');
        const tangoApp = document.getElementById('tango-app');

        if (nqueensApp) nqueensApp.classList.add('hidden');
        if (tangoApp) tangoApp.classList.add('hidden');

        if (activeGameName === 'tango') {
            if (tangoApp) tangoApp.classList.remove('hidden');
            TangoApp.init();
        } else {
            // Default to NQueens (activeGameName === 'nqueens')
            if (nqueensApp) nqueensApp.classList.remove('hidden');
            NQueensApp.init();
        }
    }
    
    // Start the application after DOM content is fully loaded
    initApp();
});
