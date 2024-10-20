// 全局變量
var tasks = [];
var durations = [];
var layers = [];
var dependencies = [];
var delays = []; // 新增延遲時間的數組
var startTimes = [];
var workCrews = 1; // 初始工班數為1，並在一開始設定後無法再更改
var lobChart;
var actualData = {}; // 用來存儲實際進度數據的對象
var projectName = ''; // 用來存儲工程名稱的變量

// 初始化工班數設定，選擇後不可更改
function initWorkCrews() {
    var workCrewsInput = document.getElementById('work-crews');
    workCrews = parseInt(workCrewsInput.value, 10) || 1;
    workCrewsInput.disabled = true; // 一旦設定後不可再更改
}

// 設定工程名稱，並禁用該輸入框以防止更改
function setProjectName() {
    var projectNameInput = document.getElementById('project-name');
    projectName = projectNameInput.value.trim(); // 設置全局變量
    projectNameInput.disabled = true; // 禁用該輸入框以防止更改
    var chartTitle = document.getElementById('chart-title');
    if (projectName) {
        chartTitle.textContent = '工程名稱：' + projectName;
    } else {
        chartTitle.textContent = '工程名稱：未設定';
    }
}

// 添加任務功能
function addTask() {
    var taskInput = document.getElementById('task-name');
    var durationInput = document.getElementById('task-duration');
    var layersInput = document.getElementById('task-layers');
    var dependencyInput = document.getElementById('task-dependencies');
    var delayInput = document.getElementById('task-delay'); // 新增延遲輸入

    var taskName = taskInput.value.trim();
    var duration = parseInt(durationInput.value, 10);
    var totalLayers = parseInt(layersInput.value, 10);
    var taskDependencies = dependencyInput.value.split(/\s+/).filter(dep => dep !== "");
    var delay = parseInt(delayInput.value, 10) || 0; // 確保延遲值有效

    // 清除錯誤訊息
    clearErrors();

    // 錯誤處理
    if (taskName === '') {
        showError('task-name', '請輸入有效的工作名稱。');
        return;
    }
    if (isNaN(duration) || duration <= 0) {
        showError('task-duration', '請輸入有效的完成一層所需的時間。');
        return;
    }
    if (isNaN(totalLayers) || totalLayers <= 0) {
        showError('task-layers', '請輸入有效的總層數。');
        return;
    }

    // 將任務添加到列表中
    tasks.push(taskName);
    durations.push(duration);
    layers.push(totalLayers);
    dependencies.push(taskDependencies);
    delays.push(delay); // 添加延遲時間
    startTimes.push(null);
    actualData[taskName] = []; // 初始化實際進度數據

    // 清空輸入框
    taskInput.value = '';
    durationInput.value = '';
    layersInput.value = '';
    dependencyInput.value = '';
    delayInput.value = '';

    updateTaskList();
    if (tasks.length > 0) {
        calculateStartTimes(tasks);
        updateChart();
    }
}

// 更新任務列表顯示
function updateTaskList() {
    var taskListDiv = document.getElementById('task-list');
    taskListDiv.innerHTML = '<h2>已添加的工作</h2><ul>';
    tasks.forEach((task, index) => {
        taskListDiv.innerHTML += `<li>${task} - 時間: ${durations[index]}, 層數: ${layers[index]}, 延遲: ${delays[index]} 天, 前置作業: ${dependencies[index].join(', ')}</li>`;
    });
    taskListDiv.innerHTML += '</ul>';
}

// 顯示錯誤訊息
function showError(inputId, message) {
    var errorSpan = document.getElementById(inputId + '-error');
    errorSpan.textContent = message;
}

// 清除錯誤訊息
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(span => span.textContent = '');
}

// 更新 LOB 圖表
function updateChart() {
    if (lobChart) {
        lobChart.destroy();
    }

    var ctx = document.getElementById('lob-chart').getContext('2d');
    var sortedTasks = topoSort(tasks, dependencies);
    calculateStartTimes(sortedTasks);

    var labels = generateTimeLabels();
    var datasets = sortedTasks.map((task, index) => {
        const startTime = startTimes[index];
        return {
            label: task + ' (預計)',
            data: calculateProgress(startTime, durations[tasks.indexOf(task)], layers[tasks.indexOf(task)]),
            borderColor: getRandomColor(),
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            borderWidth: 2,
            fill: false,
            lineTension: 0.2
        };
    });

    // 添加實際數據的數據集
    Object.keys(actualData).forEach((task) => {
        if (actualData[task].length > 0) {
            datasets.push({
                label: task + ' (實際)',
                data: actualData[task],
                borderColor: 'red',
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                borderDash: [5, 5],
                borderWidth: 2,
                fill: false,
                lineTension: 0.2
            });
        }
    });

    lobChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '時間（天）'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '完成的層數'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '工作：' + context.dataset.label + ', 第 ' + context.label + ' 天, 層數：' + context.raw;
                        }
                    }
                }
            }
        }
    });
}

// 生成時間標籤
function generateTimeLabels() {
    // 計算最大工期，考慮層數、延遲和時間
    var maxDuration = Math.max(...durations.map((duration, index) => duration * layers[index] + delays[index]));
    var extendedDuration = maxDuration + 30; // 延長30天的時間標籤範圍
    var labels = [];
    
    // 生成範圍內的天數標籤
    for (var i = 0; i <= extendedDuration; i++) {
        labels.push('第 ' + i + ' 天');
    }
    
    return labels;
}

// 計算進度
function calculateProgress(startTime, duration, totalLayers) {
    var progress = [];
    for (var i = 0; i <= startTime + (duration * totalLayers); i++) {
        if (i < startTime) {
            progress.push(0); // 在開始時間之前，進度為0
        } else {
            var layerCompleted = Math.min((i - startTime) / duration, totalLayers);
            progress.push(layerCompleted); // 計算當前時間點已完成的層數
        }
    }
    return progress;
}

// 隨機生成顏色
function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// 拓撲排序
function topoSort(tasks, dependencies) {
    // 建立依賴關係圖
    var graph = {};
    var inDegree = new Array(tasks.length).fill(0);

    tasks.forEach((task, index) => {
        graph[task] = [];
    });

    dependencies.forEach((deps, index) => {
        deps.forEach(dep => {
            graph[dep].push(tasks[index]);
            inDegree[index]++;
        });
    });

    var queue = [];
    var sortedTasks = [];

    // 找到所有入度為0的任務
    inDegree.forEach((degree, index) => {
        if (degree === 0) {
            queue.push(tasks[index]);
        }
    });

    while (queue.length > 0) {
        var task = queue.shift();
        sortedTasks.push(task);

        graph[task].forEach(neighbor => {
            var neighborIndex = tasks.indexOf(neighbor);
            inDegree[neighborIndex]--;

            if (inDegree[neighborIndex] === 0) {
                queue.push(neighbor);
            }
        });
    }

    return sortedTasks;
}

// 根據延遲時間初始化開始時間
function calculateStartTimes(sortedTasks) {
    startTimes = new Array(tasks.length).fill(0);

    sortedTasks.forEach((task, index) => {
        var taskIndex = tasks.indexOf(task);
        var dependenciesForTask = dependencies[taskIndex];
        var maxDependencyEndTime = 0;

        dependenciesForTask.forEach(dep => {
            var depIndex = sortedTasks.indexOf(dep);
            var depTaskIndex = tasks.indexOf(dep);
            var depStartTime = startTimes[depIndex];
            var depDuration = durations[depTaskIndex];
            var depLayers = layers[depTaskIndex];
            var depDelay = delays[depTaskIndex]; // 獲取前置任務的延遲
            var depEndTime = depStartTime + (depDuration * depLayers) + depDelay; // 加上延遲

            if (depEndTime > maxDependencyEndTime) {
                maxDependencyEndTime = depEndTime;
            }
        });

        // 計算當前任務的開始時間，考慮工班數和延遲
        startTimes[index] = Math.max(startTimes[index], maxDependencyEndTime) + delays[taskIndex];
    });
}

// 匯出圖表為 PDF
document.getElementById('export-pdf-button').addEventListener('click', function() {
    var chart = document.getElementById('lob-chart');
    html2canvas(chart).then(canvas => {
        var imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        var pdf = new jsPDF();
        var imgWidth = 210; // PDF 頁面寬度
        var pageHeight = 295; // PDF 頁面高度
        var imgHeight = canvas.height * imgWidth / canvas.width;
        var heightLeft = imgHeight;

        var position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save('lob_chart.pdf');
    });
});

// 初始化設定
document.getElementById('work-crews').addEventListener('change', initWorkCrews);
document.getElementById('project-name').addEventListener('blur', setProjectName);
document.getElementById('add-task-button').addEventListener('click', addTask);

// 頁面加載完成後執行初始化設定
window.onload = function() {
    initWorkCrews();
};
