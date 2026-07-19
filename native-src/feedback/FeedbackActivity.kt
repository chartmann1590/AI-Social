package com.charles.aisocial.feedback

import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.charles.aisocial.BuildConfig
import com.charles.aisocial.data.feedback.BugReport
import com.charles.aisocial.data.feedback.CreateIssueRequest
import com.charles.aisocial.data.feedback.GithubComment
import com.charles.aisocial.data.feedback.GithubIssue
import com.charles.aisocial.data.feedback.PostCommentRequest
import com.charles.aisocial.data.feedback.UploadAssetRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

class FeedbackActivity : ComponentActivity() {

    private lateinit var bugReportRepo: BugReportRepo
    private var githubService: GithubService? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        bugReportRepo = BugReportRepo(this)
        
        val proxyBaseUrl = BuildConfig.GITHUB_PROXY_BASE_URL
        val appSecret = BuildConfig.GITHUB_PROXY_APP_SECRET
        githubService = if (!proxyBaseUrl.isNullOrEmpty() && !appSecret.isNullOrEmpty()) {
            GithubClient.createService(proxyBaseUrl, appSecret)
        } else {
            null
        }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF6200EE),
                    secondary = Color(0xFF03DAC6),
                    background = Color(0xFF121212),
                    surface = Color(0xFF1E1E1E),
                    error = Color(0xFFCF6679),
                    onPrimary = Color.White,
                    onSecondary = Color.Black,
                    onBackground = Color.White,
                    onSurface = Color.White
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    FeedbackDashboardScreen(
                        repo = bugReportRepo,
                        githubService = githubService,
                        onBack = { finish() }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedbackDashboardScreen(
    repo: BugReportRepo,
    githubService: GithubService?,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val bugReportsState = repo.bugReports.collectAsState(initial = emptyList())
    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedReport by remember { mutableStateOf<BugReport?>(null) }
    var checkingConfigError by remember { mutableStateOf<String?>(null) }

    // Run initial configuration check
    LaunchedEffect(Unit) {
        val proxyBaseUrl = BuildConfig.GITHUB_PROXY_BASE_URL
        val appSecret = BuildConfig.GITHUB_PROXY_APP_SECRET
        val owner = BuildConfig.GITHUB_REPO_OWNER
        val repository = BuildConfig.GITHUB_REPO_NAME

        if (proxyBaseUrl.isNullOrEmpty() || appSecret.isNullOrEmpty()) {
            checkingConfigError = "Feedback proxy is not configured. Feedback submission is disabled."
        } else if (owner.isNullOrEmpty() || owner == "REPLACE_WITH_REPO_OWNER" ||
            repository.isNullOrEmpty() || repository == "REPLACE_WITH_REPO_NAME"
        ) {
            checkingConfigError = "GitHub repository owner or name is misconfigured. Please check configuration."
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Support & Feedback", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreateDialog = true },
                icon = { Icon(Icons.Default.Add, contentDescription = "Report Problem") },
                text = { Text("Report a Problem") },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp)
        ) {
            if (checkingConfigError != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = "Config Error",
                            tint = MaterialTheme.colorScheme.onErrorContainer
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = checkingConfigError ?: "",
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            Text(
                text = "Submitted Reports",
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            if (bugReportsState.value.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No reports submitted yet. Tap 'Report a Problem' to create one.",
                        color = Color.Gray,
                        fontSize = 14.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(bugReportsState.value) { report ->
                        ReportRow(report = report, onClick = { selectedReport = report })
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateReportDialog(
            githubService = githubService,
            configError = checkingConfigError,
            onDismiss = { showCreateDialog = false },
            onSuccess = { newReport ->
                coroutineScope.launch {
                    repo.saveBugReport(newReport)
                    showCreateDialog = false
                    Toast.makeText(context, "Report submitted successfully!", Toast.LENGTH_LONG).show()
                }
            }
        )
    }

    if (selectedReport != null) {
        ReportDetailsDialog(
            report = selectedReport!!,
            githubService = githubService,
            onDismiss = { selectedReport = null },
            onStatusChanged = { updatedReport ->
                coroutineScope.launch {
                    repo.saveBugReport(updatedReport)
                }
            }
        )
    }
}

@Composable
fun ReportRow(report: BugReport, onClick: () -> Unit) {
    val isOpen = report.status.lowercase() == "open"
    val statusColor = if (isOpen) Color(0xFF4CAF50) else Color(0xFFE53935)
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = report.title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "#${report.number}",
                        color = Color.LightGray,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = report.createdAt,
                        color = Color.Gray,
                        fontSize = 13.sp
                    )
                }
            }
            
            Surface(
                color = statusColor.copy(alpha = 0.15f),
                shape = RoundedCornerShape(4.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, statusColor.copy(alpha = 0.5f))
            ) {
                Text(
                    text = report.status.uppercase(),
                    color = statusColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateReportDialog(
    githubService: GithubService?,
    configError: String?,
    onDismiss: () -> Unit,
    onSuccess: (BugReport) -> Unit
) {
    val context = LocalContext.current
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var includeDiagnostics by remember { mutableStateOf(true) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var attachedImageUri by remember { mutableStateOf<Uri?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    val pickImageLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        attachedImageUri = uri
    }

    Dialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Report a Problem") },
                    navigationIcon = {
                        IconButton(onClick = onDismiss, enabled = !isSubmitting) {
                            Icon(Icons.Default.Close, contentDescription = "Close")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.1f)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "SECURITY WARNING",
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.error,
                                    fontSize = 13.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Your report will be submitted to this app's GitHub issue tracker. Do not include passwords, private keys, medical information, financial information, or anything you do not want visible to the repository maintainers. If this repository is public, your report may be publicly visible.",
                                    color = Color.LightGray,
                                    fontSize = 12.sp,
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }

                    item {
                        OutlinedTextField(
                            value = title,
                            onValueChange = { title = it },
                            label = { Text("Title *") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            enabled = !isSubmitting
                        )
                    }

                    item {
                        OutlinedTextField(
                            value = description,
                            onValueChange = { description = it },
                            label = { Text("Description *") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(150.dp),
                            maxLines = 10,
                            enabled = !isSubmitting
                        )
                    }

                    item {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Name (Optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            enabled = !isSubmitting
                        )
                    }

                    item {
                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = { Text("Email (Optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            enabled = !isSubmitting
                        )
                    }

                    item {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !isSubmitting) {
                                    includeDiagnostics = !includeDiagnostics
                                }
                        ) {
                            Checkbox(
                                checked = includeDiagnostics,
                                onCheckedChange = { includeDiagnostics = it },
                                enabled = !isSubmitting
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text("Include diagnostics", fontWeight = FontWeight.Medium)
                                Text("App version, OS level, and safe device metrics.", fontSize = 12.sp, color = Color.Gray)
                            }
                        }
                    }

                    item {
                        Divider()
                    }

                    item {
                        Column {
                            Text("Attachment", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            if (attachedImageUri != null) {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            modifier = Modifier.weight(1f),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(Icons.Default.CheckCircle, contentDescription = "Selected", tint = Color(0xFF4CAF50))
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Text(
                                                text = attachedImageUri!!.lastPathSegment ?: "image.png",
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                        IconButton(onClick = { attachedImageUri = null }, enabled = !isSubmitting) {
                                            Icon(Icons.Default.Delete, contentDescription = "Remove")
                                        }
                                    }
                                }
                            } else {
                                Button(
                                    onClick = { pickImageLauncher.launch("image/*") },
                                    enabled = !isSubmitting,
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant, contentColor = Color.White)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = "Add Screenshot")
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Attach Screenshot/Image")
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Please note: Attached screenshots may capture private information visible on your screen.",
                                color = Color.Gray,
                                fontSize = 11.sp,
                                lineHeight = 14.sp
                            )
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(80.dp))
                    }
                }

                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 8.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f),
                            enabled = !isSubmitting
                        ) {
                            Text("Cancel")
                        }

                        Button(
                            onClick = {
                                if (title.trim().isEmpty() || description.trim().isEmpty()) {
                                    Toast.makeText(context, "Title and Description are required", Toast.LENGTH_SHORT).show()
                                    return@Button
                                }
                                if (githubService == null || configError != null) {
                                    Toast.makeText(context, "Configuration error. Submission disabled.", Toast.LENGTH_LONG).show()
                                    return@Button
                                }
                                
                                isSubmitting = true
                                CoroutineScope(Dispatchers.IO).launch {
                                    try {
                                        var imageUrl: String? = null
                                        if (attachedImageUri != null) {
                                            val base64 = ImageUploadHelper.uriToBase64(context, attachedImageUri!!)
                                            val uniqueFilename = "feedback-assets/issue-${SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())}-${(1000..9999).random()}.png"
                                            val assetReq = UploadAssetRequest("Upload screenshot for feedback", base64)
                                            val res = githubService.uploadAsset(
                                                BuildConfig.GITHUB_REPO_OWNER,
                                                BuildConfig.GITHUB_REPO_NAME,
                                                uniqueFilename,
                                                assetReq
                                            )
                                            imageUrl = res.content?.downloadUrl
                                        }

                                        val diag = if (includeDiagnostics) DiagnosticsHelper.collect(context) else ""
                                        
                                        val issueBody = buildString {
                                            append("## Description\n\n")
                                            append(description)
                                            append("\n\n## Contact Info\n\n")
                                            append("- Name: ").append(name.ifBlank { "Not provided" }).append("\n")
                                            append("- Email: ").append(email.ifBlank { "Not provided" }).append("\n")
                                            if (imageUrl != null) {
                                                append("\n\n## Attachment\n\n")
                                                append("![Screenshot]($imageUrl)\n")
                                            }
                                            if (diag.isNotEmpty()) {
                                                append("\n\n").append(diag)
                                            }
                                        }

                                        val issueTitle = "[Feedback] ${title.trim()}"
                                        val req = CreateIssueRequest(issueTitle, issueBody)
                                        val createdIssue = githubService.createIssue(
                                            BuildConfig.GITHUB_REPO_OWNER,
                                            BuildConfig.GITHUB_REPO_NAME,
                                            req
                                        )

                                        withContext(Dispatchers.Main) {
                                            onSuccess(
                                                BugReport(
                                                    number = createdIssue.number,
                                                    title = title,
                                                    status = createdIssue.state,
                                                    createdAt = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date()),
                                                    htmlUrl = createdIssue.htmlUrl
                                                )
                                            )
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) {
                                            isSubmitting = false
                                            Toast.makeText(context, "Error: ${e.localizedMessage ?: "Unknown network error"}", Toast.LENGTH_LONG).show()
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = !isSubmitting && configError == null,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(size = 20.dp, color = MaterialTheme.colorScheme.onPrimary)
                            } else {
                                Text("Submit")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CircularProgressIndicator(size: androidx.compose.ui.unit.Dp, color: Color) {
    CircularProgressIndicator(
        modifier = Modifier.size(size),
        color = color,
        strokeWidth = 2.dp
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportDetailsDialog(
    report: BugReport,
    githubService: GithubService?,
    onDismiss: () -> Unit,
    onStatusChanged: (BugReport) -> Unit
) {
    val context = LocalContext.current
    var comments by remember { mutableStateOf<List<GithubComment>>(emptyList()) }
    var issueDetail by remember { mutableStateOf<GithubIssue?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var commentText by remember { mutableStateOf("") }
    var attachedImageUri by remember { mutableStateOf<Uri?>(null) }
    var isPostingComment by remember { mutableStateOf(false) }

    val pickImageLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        attachedImageUri = uri
    }

    val loadDetails = suspend {
        if (githubService != null) {
            try {
                val issue = githubService.getIssue(
                    BuildConfig.GITHUB_REPO_OWNER,
                    BuildConfig.GITHUB_REPO_NAME,
                    report.number
                )
                val comms = githubService.getComments(
                    BuildConfig.GITHUB_REPO_OWNER,
                    BuildConfig.GITHUB_REPO_NAME,
                    report.number
                )
                issueDetail = issue
                comments = comms
                
                // Sync status locally
                if (issue.state != report.status) {
                    onStatusChanged(report.copy(status = issue.state))
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Error fetching updates: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                isLoading = false
            }
        } else {
            isLoading = false
        }
    }

    LaunchedEffect(report.number) {
        withContext(Dispatchers.IO) {
            loadDetails()
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(report.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            Text("Issue #${report.number}", fontSize = 12.sp, color = Color.LightGray)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(size = 40.dp, color = MaterialTheme.colorScheme.primary)
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = 80.dp)
                    ) {
                        LazyColumn(
                            modifier = Modifier
                                .weight(1f)
                                .padding(horizontal = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            item {
                                Spacer(modifier = Modifier.height(8.dp))
                                // Issue state and info
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            val currentStatus = issueDetail?.state ?: report.status
                                            val isOpen = currentStatus.lowercase() == "open"
                                            val statusColor = if (isOpen) Color(0xFF4CAF50) else Color(0xFFE53935)
                                            
                                            Text("Status", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            Surface(
                                                color = statusColor.copy(alpha = 0.15f),
                                                shape = RoundedCornerShape(4.dp),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, statusColor.copy(alpha = 0.5f))
                                            ) {
                                                Text(
                                                    text = currentStatus.uppercase(),
                                                    color = statusColor,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                )
                                            }
                                        }
                                        
                                        issueDetail?.body?.let { body ->
                                            Spacer(modifier = Modifier.height(12.dp))
                                            Divider()
                                            Spacer(modifier = Modifier.height(12.dp))
                                            Text("Original Report:", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.LightGray)
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text(
                                                text = body.substringBefore("## Diagnostics").trim(),
                                                fontSize = 14.sp,
                                                lineHeight = 20.sp
                                            )
                                        }
                                    }
                                }
                            }

                            item {
                                Text("Comments & Activity", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }

                            if (comments.isEmpty()) {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 32.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("No comments yet. Post a reply below.", color = Color.Gray, fontSize = 14.sp)
                                    }
                                }
                            } else {
                                items(comments) { comment ->
                                    CommentRow(comment = comment)
                                }
                            }
                        }
                    }

                    // Floating Reply bottom bar
                    Surface(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth(),
                        color = MaterialTheme.colorScheme.surface,
                        tonalElevation = 8.dp
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            if (attachedImageUri != null) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                                        .padding(horizontal = 12.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Image selected", fontSize = 12.sp, color = Color.LightGray)
                                    IconButton(onClick = { attachedImageUri = null }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Clear Image", tint = Color.LightGray, modifier = Modifier.size(16.dp))
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                            
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = { pickImageLauncher.launch("image/*") },
                                    enabled = !isPostingComment
                                ) {
                                    Icon(Icons.Default.AddCircle, contentDescription = "Attach Screenshot", tint = MaterialTheme.colorScheme.primary)
                                }
                                
                                OutlinedTextField(
                                    value = commentText,
                                    onValueChange = { commentText = it },
                                    placeholder = { Text("Write a reply…") },
                                    modifier = Modifier.weight(1f),
                                    maxLines = 4,
                                    singleLine = false,
                                    enabled = !isPostingComment,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = Color.Gray
                                    )
                                )
                                
                                Spacer(modifier = Modifier.width(8.dp))
                                
                                IconButton(
                                    onClick = {
                                        if (commentText.trim().isEmpty()) return@IconButton
                                        if (githubService == null) return@IconButton
                                        
                                        isPostingComment = true
                                        CoroutineScope(Dispatchers.IO).launch {
                                            try {
                                                var imageUrl: String? = null
                                                if (attachedImageUri != null) {
                                                    val base64 = ImageUploadHelper.uriToBase64(context, attachedImageUri!!)
                                                    val uniqueFilename = "feedback-assets/issue-${SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())}-${(1000..9999).random()}.png"
                                                    val assetReq = UploadAssetRequest("Upload screenshot for comment", base64)
                                                    val res = githubService.uploadAsset(
                                                        BuildConfig.GITHUB_REPO_OWNER,
                                                        BuildConfig.GITHUB_REPO_NAME,
                                                        uniqueFilename,
                                                        assetReq
                                                    )
                                                    imageUrl = res.content?.downloadUrl
                                                }

                                                val finalCommentBody = buildString {
                                                    append("## Reply\n\n")
                                                    append(commentText.trim())
                                                    if (imageUrl != null) {
                                                        append("\n\n## Attachment\n\n")
                                                        append("![Screenshot]($imageUrl)\n")
                                                    }
                                                }

                                                githubService.postComment(
                                                    BuildConfig.GITHUB_REPO_OWNER,
                                                    BuildConfig.GITHUB_REPO_NAME,
                                                    report.number,
                                                    PostCommentRequest(finalCommentBody)
                                                )

                                                commentText = ""
                                                attachedImageUri = null
                                                
                                                // Reload
                                                loadDetails()
                                            } catch (e: Exception) {
                                                withContext(Dispatchers.Main) {
                                                    Toast.makeText(context, "Failed to post reply: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                                                }
                                            } finally {
                                                isPostingComment = false
                                            }
                                        }
                                    },
                                    enabled = !isPostingComment && commentText.trim().isNotEmpty()
                                ) {
                                    if (isPostingComment) {
                                        CircularProgressIndicator(size = 20.dp, color = MaterialTheme.colorScheme.primary)
                                    } else {
                                        Icon(Icons.Default.Send, contentDescription = "Send", tint = if (commentText.trim().isNotEmpty()) MaterialTheme.colorScheme.primary else Color.Gray)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CommentRow(comment: GithubComment) {
    val dateText = try {
        // Parse GitHub date e.g. 2026-07-18T22:50:00Z
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val date = format.parse(comment.createdAt)
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(date!!)
    } catch (e: Exception) {
        comment.createdAt
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = comment.user.login,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
                Text(
                    text = dateText,
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Divider()
            Spacer(modifier = Modifier.height(8.dp))
            
            // Basic body processing to strip markup prefixes if we want, or just show text
            val displayBody = comment.body.substringAfter("## Reply\n\n").trim()
            Text(
                text = displayBody,
                fontSize = 14.sp,
                lineHeight = 18.sp
            )
        }
    }
}
