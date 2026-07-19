package com.charles.aisocial.data.feedback

import kotlinx.serialization.Serializable

@Serializable
data class BugReport(
    val number: Int,
    val title: String,
    val status: String,
    val createdAt: String,
    val htmlUrl: String
)
