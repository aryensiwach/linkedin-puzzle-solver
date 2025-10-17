document.addEventListener('DOMContentLoaded', () => {
    // Get all interactive elements from the DOM
    const uploadForm = document.getElementById('upload-form');
    const editorContainer = document.getElementById('editor-container');
    const resultContainer = document.getElementById('result-container');
    const loader = document.getElementById('loader');
    const paletteContainer = document.getElementById('palette');
    const gridContainer = document.getElementById('grid-container');
    const solveBtn = document.getElementById('solve-btn');
    const solutionGrid = document.getElementById('solution-grid');
    const imageInput = document.getElementById('puzzle-image');

    // Application state variables
    let currentRows, currentCols;
    let selectedColor;

    // --- Event Listener for the initial form submission ---
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // --- Edge Case Handling ---
        const imageFile = imageInput.files[0];
        if (!imageFile) {
            alert('Please select an image file first.');
            return;
        }
        if (!imageFile.type.startsWith('image/')) {
            alert('Invalid file type. Please upload an image (PNG, JPG, etc.).');
            return;
        }

        const processBtn = uploadForm.querySelector('button');
        processBtn.disabled = true;
        loader.classList.remove('hidden');
        editorContainer.classList.add('hidden');
        resultContainer.classList.add('hidden');

        const formData = new FormData(uploadForm);
        
        try {
            const response = await fetch('/process', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();

            if (response.ok) {
                populateEditor(result.colorMap, result.rows, result.cols);
                editorContainer.classList.remove('hidden');
            } else {
                alert(`Error: ${result.error || 'Failed to process image.'}`);
            }
        } catch (error) {
            console.error('Processing Error:', error);
            alert('An error occurred while communicating with the server.');
        } finally {
            loader.classList.add('hidden');
            processBtn.disabled = false;
        }
    });

    // --- Function to build the interactive editor ---
    function populateEditor(colorMap, rows, cols) {
        currentRows = rows;
        currentCols = cols;

        const uniqueColors = [...new Set(colorMap.flat())];
        if (uniqueColors.length === 0) {
            alert("Could not detect any colors in the image.");
            return;
        }
        selectedColor = uniqueColors[0];
        
        paletteContainer.innerHTML = '';
        uniqueColors.forEach((color, index) => {
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = color;
            if (index === 0) colorBox.classList.add('selected');
            
            colorBox.addEventListener('click', () => {
                selectedColor = color;
                document.querySelectorAll('.color-box').forEach(box => box.classList.remove('selected'));
                colorBox.classList.add('selected');
            });
            paletteContainer.appendChild(colorBox);
        });

        // Add a "Clear Grid" button for better UX
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear Grid';
        clearBtn.style.backgroundColor = '#6c757d'; // A neutral color
        clearBtn.style.marginLeft = '1rem';
        clearBtn.style.width = 'auto';
        clearBtn.addEventListener('click', () => {
             document.querySelectorAll('#grid-container .grid-cell').forEach(cell => {
                 cell.style.backgroundColor = '#FFFFFF';
             });
        });
        paletteContainer.appendChild(clearBtn);

        const table = document.createElement('table');
        table.className = 'grid-table';
        
        for (let i = 0; i < rows; i++) {
            const tr = document.createElement('tr');
            for (let j = 0; j < cols; j++) {
                const td = document.createElement('td');
                td.className = 'grid-cell';
                td.style.backgroundColor = colorMap[i][j];
                td.addEventListener('click', () => {
                    td.style.backgroundColor = selectedColor;
                });
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        
        gridContainer.innerHTML = '';
        gridContainer.appendChild(table);
    }

    // --- Event Listener for the "Solve Puzzle" button ---
    solveBtn.addEventListener('click', async () => {
        solveBtn.disabled = true;
        loader.classList.remove('hidden');
        resultContainer.classList.add('hidden');

        const cells = document.querySelectorAll('#grid-container .grid-cell');
        const colorIdMap = {};
        let nextId = 0;
        const numericMap = Array(currentRows).fill(null).map(() => Array(currentCols).fill(-1));
        
        let cellIndex = 0;
        for (let r = 0; r < currentRows; r++) {
            for (let c = 0; c < currentCols; c++) {
                const bgColor = cells[cellIndex].style.backgroundColor;
                if (!colorIdMap.hasOwnProperty(bgColor)) {
                    colorIdMap[bgColor] = nextId++;
                }
                numericMap[r][c] = colorIdMap[bgColor];
                cellIndex++;
            }
        }
        
        if (Object.keys(colorIdMap).length !== currentRows) {
            if (!confirm(`Warning: Found ${Object.keys(colorIdMap).length} unique regions, but expected ${currentRows}. The puzzle might be unsolvable. Continue anyway?`)) {
                loader.classList.add('hidden');
                solveBtn.disabled = false;
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
                     for (let r = 0; r < currentRows; r++) {
                         const row = [];
                         for(let c = 0; c < currentCols; c++){
                             row.push(cells[cellIndex].style.backgroundColor);
                             cellIndex++;
                         }
                         originalColorMap.push(row);
                     }
                    displaySolution(result.solution, originalColorMap, currentRows, currentCols);
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
             loader.classList.add('hidden');
             solveBtn.disabled = false;
        }
    });

    // --- Function to display the final solution ---
    function displaySolution(solution, colorMap, rows, cols) {
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

        solutionGrid.innerHTML = '';
        solutionGrid.appendChild(table);
        resultContainer.classList.remove('hidden');
    }
});