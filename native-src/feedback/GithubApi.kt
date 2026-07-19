package com.charles.aisocial.feedback

import com.charles.aisocial.data.feedback.*
import com.charles.aisocial.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.http.*
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType

interface GithubService {
    @POST("repos/{owner}/{repo}/issues")
    suspend fun createIssue(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Body request: CreateIssueRequest
    ): GithubIssue

    @GET("repos/{owner}/{repo}/issues/{number}")
    suspend fun getIssue(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path("number") number: Int
    ): GithubIssue

    @GET("repos/{owner}/{repo}/issues/{number}/comments")
    suspend fun getComments(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path("number") number: Int
    ): List<GithubComment>

    @POST("repos/{owner}/{repo}/issues/{number}/comments")
    suspend fun postComment(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path("number") number: Int,
        @Body request: PostCommentRequest
    ): GithubComment

    @PUT("repos/{owner}/{repo}/contents/{assetPath}")
    suspend fun uploadAsset(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path(value = "assetPath", encoded = true) assetPath: String,
        @Body request: UploadAssetRequest
    ): UploadAssetResponse
}

object GithubClient {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    /**
     * Calls go to our Cloudflare Worker proxy (cloudflare/github-proxy), not api.github.com
     * directly. The real GitHub PAT lives only as a Worker secret; the app authenticates to
     * the worker with [appSecret], a much lower-stakes credential to have baked into an APK.
     */
    fun createService(proxyBaseUrl: String, appSecret: String): GithubService {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
            redactHeader("X-App-Secret")
        }

        val normalizedBaseUrl = if (proxyBaseUrl.endsWith("/")) proxyBaseUrl else "$proxyBaseUrl/"
        // The shared secret and feedback-report contents (which can include a user's
        // name/email/description) must never go out in cleartext. A misconfigured
        // http:// proxy URL (e.g. from a local dev tunnel) would otherwise silently
        // leak both.
        if (!normalizedBaseUrl.startsWith("https://")) {
            throw IllegalArgumentException("GitHub proxy base URL must use https://: $proxyBaseUrl")
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                    .addHeader("Accept", "application/vnd.github+json")
                    .addHeader("X-App-Secret", appSecret)
                chain.proceed(requestBuilder.build())
            }
            .addInterceptor(logging)
            .build()

        val contentType = "application/json".toMediaType()
        val retrofit = Retrofit.Builder()
            .baseUrl(normalizedBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()

        return retrofit.create(GithubService::class.java)
    }
}
